import type {
  DiagnosisReport,
  EvidenceFinding,
} from "../types";

import { runPerformanceAgent } from "./performance-agent";
import { runInfrastructureAgent } from "./infrastructure-agent";
import { runHypothesisAgent } from "./hypothesis-agent";
import { runVerificationAgent } from "./verification-agent";

import {
  AgentMessageBus,
  createAgentMessage,
} from "./agent-communication";

export async function runInvestigationCoordinator(
  telemetry: Parameters<typeof runPerformanceAgent>[0]
): Promise<DiagnosisReport> {
  const messageBus = new AgentMessageBus(telemetry.incident_id);

  // Stage 1: Execute the deterministic diagnostic agents.
  const performanceFinding = runPerformanceAgent(telemetry);
  const infrastructureFinding = runInfrastructureAgent(telemetry);

  // Stage 2: Both diagnostic agents send findings to the coordinator.
  for (const [sender, finding] of [
    ["performance-agent", performanceFinding],
    ["infrastructure-agent", infrastructureFinding],
  ] as const) {
    messageBus.send(
      createAgentMessage({
        incidentId: telemetry.incident_id,
        sender,
        recipient: "coordinator",
        messageType: "finding",
        payload: {
          observation: finding.observation,
          evidence: finding.evidence,
          limitations: finding.limitations,
        },
      })
    );
  }

  const originalFindings: EvidenceFinding[] =
    messageBus.getMessagesFor("coordinator")
      .filter((message) => message.message_type === "finding")
      .map((message) => ({
        agent: message.sender,
        observation: message.payload.observation ?? "No observation provided.",
        evidence: message.payload.evidence,
        limitations: message.payload.limitations,
      }));

  // Stage 3: The Hypothesis Agent evaluates the collected findings.
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
    ]),
  ];

  const supportedVerifications =
    verificationResult.verifications.filter(
      (verification) =>
        verification.verdict === "supported" &&
        verification.confidence >= 0.7
    );

  const observations = originalFindings
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

  for (const hypothesis of hypothesisResult.hypotheses) {
    for (const item of hypothesis.missing_evidence) {
      recommendations.push(`Investigate missing evidence: ${item}`);
    }
  }

  for (const verification of verificationResult.verifications) {
    for (const item of verification.missing_evidence) {
      recommendations.push(`Verify with additional evidence: ${item}`);
    }
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
    hypothesisResult.reasoning_summary,
    verificationResult.overall_assessment,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    incident_id: telemetry.incident_id,
    device: telemetry.device,
    status,
    summary:
      summary ||
      "The investigation could not establish a reliable root cause.",

    // Preserve original diagnostic observations separately.
    findings: originalFindings,

    // Include the traceable evidence catalogue.
    evidence_catalog: hypothesisResult.evidence_catalog,

    // Preserve the Hypothesis Agent's independent output.
    hypotheses: hypothesisResult.hypotheses,

    // Preserve the Verification Agent's independent output.
    verifications: verificationResult.verifications,

    missing_evidence: missingEvidence,
    recommendations: uniqueRecommendations,
    generated_at: new Date().toISOString(),
  };
}

