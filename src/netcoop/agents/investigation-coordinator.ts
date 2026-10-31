import {
  selectDiagnosticAgentOrder,
} from "./diagnostic-agent-runtime";
import { dispatchDiagnosticAgent } from "./agent-dispatcher";
import { planNextInvestigationStep } from "./autonomous-planner";
import { getAgentRegistration } from "./agent-registry";
import type { AgentId } from "../types";
import type {
  DiagnosisReport,
  EvidenceFinding,
} from "../types";


import { runPerformanceAgent } from "./performance-agent";

import { runInfrastructureAgent } from "./infrastructure-agent";

import { runConnectivityAgent } from "./connectivity-agent";

import { runFaultCorrelationAgent } from "./fault-correlation-agent";

import { runHypothesisAgent } from "./hypothesis-agent";

import { runVerificationAgent } from "./verification-agent";


import {
  AgentMessageBus,
  createAgentMessage,
} from "./agent-communication";
import { AgentTaskManager } from "./task-manager";

export async function runInvestigationCoordinator(
  telemetry: Parameters<typeof runPerformanceAgent>[0]
): Promise<DiagnosisReport> {
  const messageBus = new AgentMessageBus(telemetry.incident_id);

  // Stage 1: Planner-directed diagnostic investigation.
  const taskManager = new AgentTaskManager();
  const completedDiagnosticAgents: AgentId[] = [];
  const failedDiagnosticAgents: AgentId[] = [];
  const maxInvestigationSteps = 5;

  for (let step = 0; step < maxInvestigationSteps; step++) {
    const plannerFindings = messageBus.getMessagesFor("coordinator")
      .filter((message) => message.message_type === "response")
      .map((message) => ({
        agent_id: message.sender,
        summary: message.payload.observation ?? "No observation provided.",
        evidence: [],
      }));

    const missingTelemetry = Object.entries(telemetry.metrics)
      .filter(([, value]) => value === undefined)
      .map(([key]) => key);

    const plan = await planNextInvestigationStep({
      incidentId: telemetry.incident_id,
      telemetry: telemetry as unknown as Record<string, unknown>,
      findings: plannerFindings,
      missingEvidence: missingTelemetry,
      completedAgents: completedDiagnosticAgents,
      failedAgents: failedDiagnosticAgents,
      step,
      maxSteps: maxInvestigationSteps,
    });

    if (plan.action === "stop") {
      break;
    }

    if (!plan.agentId || !plan.capabilityId || !plan.requestedEvidence) {
      throw new Error("Planner returned an incomplete dispatch instruction.");
    }

    const selectedAgent = getAgentRegistration(plan.agentId as AgentId);

    if (!selectedAgent || completedDiagnosticAgents.includes(selectedAgent.id)) {
      throw new Error("Planner selected an unavailable or already completed agent.");
    }

    const request = createAgentMessage({
      incidentId: telemetry.incident_id,
      sender: "coordinator",
      recipient: selectedAgent.id,
      messageType: "request",
      payload: {
        requested_data: plan.requestedEvidence,
        evidence: [],
        limitations: [],
        observation: plan.rationale,
      },
    });

    const task = taskManager.createTask(request);

    try {
      messageBus.send(request);
      taskManager.markRunning(task.task_id);

      dispatchDiagnosticAgent({
        request,
        telemetry,
        messageBus,
        capabilityId: plan.capabilityId,
      });

      const response = messageBus.getMessagesFor("coordinator").find(
        (message) =>
          message.message_type === "response" &&
          message.correlation_id === request.message_id
      );

      if (!response) {
        throw new Error("Diagnostic agent did not return a correlated response.");
      }

      taskManager.completeFromResponse(response);
      completedDiagnosticAgents.push(selectedAgent.id);
    } catch (error) {
      const currentTask = taskManager.getTask(task.task_id);

      if (
        currentTask &&
        (currentTask.status === "pending" || currentTask.status === "running")
      ) {
        taskManager.failTask(
          task.task_id,
          error instanceof Error ? error.message : "Unknown agent execution error."
        );
      }

      throw new Error(
        `Diagnostic task for ${selectedAgent.id} failed: ${
          error instanceof Error ? error.message : "Unknown error."
        }`
      );
    }
  }
  // Stage 2: Accept only responses correlated to coordinator requests.
  const communicationMessages = messageBus.getMessages();

  const requests = communicationMessages.filter(
    (message) =>
      message.sender === "coordinator" &&
      message.message_type === "request"
  );

  const originalFindings: EvidenceFinding[] = communicationMessages
    .filter((response) =>
      response.recipient === "coordinator" &&
      response.message_type === "response" &&
      Boolean(response.correlation_id) &&
      requests.some(
        (request) =>
          request.message_id === response.correlation_id &&
          request.recipient === response.sender &&
          request.incident_id === response.incident_id
      )
    )
    .map((message) => ({
      agent: message.sender,
      observation: message.payload.observation ?? "No observation provided.",
      evidence: message.payload.evidence,
      limitations: message.payload.limitations,
    }));

  if (originalFindings.length !== completedDiagnosticAgents.length) {
    throw new Error(
      `Diagnostic communication incomplete: expected ${completedDiagnosticAgents.length} responses, received ${originalFindings.length}.`
    );
  }

  // Stage 3: The Hypothesis Agent evaluates the collected findings.
  const correlationFinding = runFaultCorrelationAgent(originalFindings);
  originalFindings.push(correlationFinding);

  messageBus.send(
    createAgentMessage({
      incidentId: telemetry.incident_id,
      sender: "fault-correlation-agent",
      recipient: "coordinator",
      messageType: "finding",
      payload: {
        observation: correlationFinding.observation,
        evidence: correlationFinding.evidence,
        limitations: correlationFinding.limitations,
      },
    })
  );
  const hypothesisResult = await runHypothesisAgent(
    telemetry.incident_id,
    telemetry.device,
    originalFindings
  );

  for (const hypothesis of hypothesisResult.hypotheses) {
    messageBus.send(
      createAgentMessage({
        incidentId: telemetry.incident_id,
        sender: "hypothesis-agent",
        recipient: "coordinator",
        messageType: "hypothesis",
        payload: {
          hypothesis: hypothesis.explanation,
          confidence: hypothesis.confidence,
          evidence: hypothesis.supporting_evidence,
          limitations: [
            ...hypothesis.contradicting_evidence,
            ...hypothesis.missing_evidence,
          ],
        },
      })
    );
  }

  // Stage 4: The Verification Agent independently challenges hypotheses.
  const verificationResult = await runVerificationAgent({
    telemetry,
    findings: originalFindings,
    hypotheses: hypothesisResult.hypotheses,
    evidenceCatalog: hypothesisResult.evidence_catalog,
  });


  for (const verification of verificationResult.verifications) {
    messageBus.send(
      createAgentMessage({
        incidentId: telemetry.incident_id,
        sender: "verification-agent",
        recipient: "coordinator",
        messageType: "verification",
        payload: {
          verdict: `${verification.hypothesis_id}: ${verification.verdict}. ${verification.reasoning}`,
          confidence: verification.confidence,
          evidence: [
            ...verification.supporting_evidence,
            ...verification.contradicting_evidence,
          ],
          limitations: verification.missing_evidence,
        },
      })
    );
  }

  // Stage 5: Coordinator collects all agent messages.
  const allMessages = messageBus.getMessagesFor("coordinator");

  const agentFindings: EvidenceFinding[] = allMessages
    .filter((message) =>
      message.message_type === "hypothesis" ||
      message.message_type === "verification"
    )
    .map((message) => ({
      agent: message.sender,
      observation:
        message.payload.hypothesis ??
        message.payload.verdict ??
        "No agent assessment provided.",
      evidence: message.payload.evidence,
      limitations: message.payload.limitations,
    }));

  const findings = [...originalFindings, ...agentFindings];

  const knownEvidenceIds = new Set(
    hypothesisResult.evidence_catalog.map((item) => item.id)
  );

  const missingEvidence = [
    ...new Set([
      ...findings.flatMap((finding) => finding.limitations),
      ...hypothesisResult.limitations,
      ...verificationResult.limitations,
      ...hypothesisResult.hypotheses.flatMap(
        (hypothesis) => hypothesis.missing_evidence
      ),
      ...verificationResult.verifications.flatMap(
        (verification) => verification.missing_evidence
      ),
    ].filter((item) => !knownEvidenceIds.has(item.trim()))),
  ];

  const supportedVerifications =
    verificationResult.verifications.filter(
      (verification) =>
        verification.verdict === "supported" &&
        verification.confidence >= 0.7
    );

  
  // Preserve evidence from the leading inconclusive hypothesis without
  // promoting it to a confirmed diagnosis.
  const leadingVerification = [...verificationResult.verifications]
    .sort((a, b) => b.confidence - a.confidence)[0];

  const leadingHypothesis = leadingVerification
    ? hypothesisResult.hypotheses.find(
        (item) => item.id === leadingVerification.hypothesis_id
      )
    : undefined;

  const reportEvidenceIds = [
    ...new Set(
      (supportedVerifications.length > 0
        ? supportedVerifications
        : leadingVerification
          ? [leadingVerification]
          : []
      ).flatMap((item) => item.supporting_evidence)
    ),
  ];const observations = originalFindings
    .filter((finding) => finding.evidence.length > 0)
    .map((finding) => finding.observation);

  const recommendations: string[] = [];

  if (telemetry.metrics.bandwidth_mbps === undefined) {
    recommendations.push("Collect bandwidth measurements.");
  }

  if (telemetry.metrics.utilization_percent === undefined) {
    recommendations.push("Collect network-interface utilization metrics.");
  }

  if (telemetry.metrics.interface_errors === undefined) {
    recommendations.push("Collect network-interface error counters.");
  }

  if (telemetry.metrics.queue_drops === undefined) {
    recommendations.push("Collect network queue-drop counters.");
  }

  if (telemetry.metrics.cpu_utilization_percent === undefined) {
    recommendations.push("Collect CPU utilization metrics.");
  }

  if (telemetry.metrics.memory_utilization_percent === undefined) {
    recommendations.push("Collect memory utilization metrics.");
  }

  // Merge missing-evidence requests from both reasoning agents.
  const additionalEvidence = new Set<string>();

  for (const hypothesis of hypothesisResult.hypotheses) {
    for (const item of hypothesis.missing_evidence) {
      const normalized = item.trim();
      if (normalized) additionalEvidence.add(normalized);
    }
  }

  for (const verification of verificationResult.verifications) {
    for (const item of verification.missing_evidence) {
      const normalized = item.trim();
      if (normalized) additionalEvidence.add(normalized);
    }
  }

  for (const item of additionalEvidence) {
    recommendations.push(`Collect additional evidence: ${item}`);
  }

  if (supportedVerifications.length === 0) {
    recommendations.push(
      "Do not treat any root cause as confirmed. Collect the missing evidence and repeat the investigation."
    );
  } else {
    recommendations.push(
      "Validate the supported hypotheses against historical telemetry and device logs before taking corrective action."
    );
  }

  const uniqueRecommendations = [...new Set(recommendations)];

  const status: DiagnosisReport["status"] =
    supportedVerifications.length === 1
      ? "probable_cause"
      : supportedVerifications.length > 1
        ? "multiple_plausible_causes"
        : "insufficient_evidence";

  const summary = [
    observations.join(" "),
    hypothesisResult.hypotheses.length > 0
      ? `The investigation evaluated ${hypothesisResult.hypotheses.length} hypothesis(es).`
      : "No valid root-cause hypothesis was produced.",
    `Independent verification: ${verificationResult.verifications.map((item) => `${item.hypothesis_id} is ${item.verdict}`).join("; ") || "not available"}.`,
    supportedVerifications.length > 0
      ? "A hypothesis passed the verification confidence threshold. Validate it against historical telemetry before remediation."
      : "No root cause is confirmed. Elevated symptoms are not proof of their cause. Collect missing evidence and investigate again.",
  ].filter(Boolean).join(" ");

  return {
    incident_id: telemetry.incident_id,
    device: telemetry.device,
    status,
    summary:
      summary ||
      "The investigation could not establish a reliable root cause.",

    suspected_root_cause:
      supportedVerifications.length > 0
        ? hypothesisResult.hypotheses.find(
            (item) => item.id === supportedVerifications[0].hypothesis_id
          )?.explanation ?? "Verified hypothesis unavailable."
        : leadingHypothesis
          ? `Unconfirmed hypothesis: ${leadingHypothesis.explanation}`
          : "Insufficient evidence to establish a probable root cause.",

    confidence:
      supportedVerifications.length > 0
        ? supportedVerifications[0].confidence
        : leadingVerification
          ? Math.min(
              leadingVerification.confidence,
              leadingHypothesis?.confidence ?? leadingVerification.confidence
            )
          : 0,

    affected_devices: [],

    supporting_evidence: reportEvidenceIds.map((id) => {
      const reference = hypothesisResult.evidence_catalog.find(
        (item) => item.id === id
      );
      return {
        metric: reference?.statement.split(":")[0] ?? "unknown",
        value: reference?.statement.split(":").slice(1).join(":").trim() ?? "Not available",
        interpretation: reference?.statement ?? "Evidence reference unavailable",
      };
    }),

    alternative_causes: hypothesisResult.hypotheses
      .filter((item) =>
        !supportedVerifications.some(
          (verification) => verification.hypothesis_id === item.id
        )
      )
      .map((item) => item.explanation),

    recommended_actions: uniqueRecommendations,

    evidence_sources: [...new Set(originalFindings.map((item) => item.agent))],
    // Preserve original diagnostic observations separately.
    findings: originalFindings,

    // Include the traceable evidence catalogue.
    evidence_catalog: hypothesisResult.evidence_catalog,

    // Preserve the Hypothesis Agent's independent output.
    hypotheses: hypothesisResult.hypotheses,

    // Preserve the Verification Agent's independent output.
    verifications: verificationResult.verifications,

    missing_evidence: missingEvidence,

    limitations: [

      ...new Set([

        ...findings.flatMap((finding) => finding.limitations),

        ...hypothesisResult.limitations,

        ...verificationResult.limitations,

      ]),

    ],
    recommendations: uniqueRecommendations,
    generated_at: new Date().toISOString(),
  };
}











