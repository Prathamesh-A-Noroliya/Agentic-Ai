import { generateLLMResponse, parseLLMJson } from "../llm/client";
import { getRegisteredAgents } from "./agent-registry";

export interface InvestigationPlanInput {
  incidentId: string;
  telemetry: Record<string, unknown>;
  findings: Array<{
    agent_id: string;
    summary: string;
    evidence: Array<{ evidence_id: string; description: string }>;
  }>;
  missingEvidence: string[];
  completedAgents: string[];
  failedAgents?: string[];
  step: number;
  maxSteps?: number;
}

export interface InvestigationPlan {
  action: "dispatch" | "stop";
  agentId?: string;
  capabilityId?: string;
  requestedEvidence?: string[];
  rationale: string;
}

export async function planNextInvestigationStep(
  input: InvestigationPlanInput
): Promise<InvestigationPlan> {
  const maxSteps = input.maxSteps ?? 5;

  if (input.step >= maxSteps) {
    return { action: "stop", rationale: "Maximum investigation steps reached." };
  }

  const availableAgents = getRegisteredAgents().filter(
    (agent) =>
      agent.role === "diagnostic" &&
      !input.completedAgents.includes(agent.id) &&
      !(input.failedAgents ?? []).includes(agent.id)
  );

  if (availableAgents.length === 0) {
    return { action: "stop", rationale: "No uncompleted diagnostic agents remain." };
  }

  const rawMetrics = input.telemetry.metrics;
  const metrics: Record<string, unknown> =
    rawMetrics && typeof rawMetrics === "object"
      ? rawMetrics as Record<string, unknown>
      : input.telemetry;

  const coverage = (evidenceTypes: string[]) =>
    evidenceTypes.filter(
      (type) =>
        Object.prototype.hasOwnProperty.call(metrics, type) &&
        metrics[type] !== undefined &&
        metrics[type] !== null
    );

  const rankedAgents = [...availableAgents].sort(
    (a, b) =>
      Math.max(...b.capabilities.map((c) => coverage(c.evidenceTypes).length), 0) -
      Math.max(...a.capabilities.map((c) => coverage(c.evidenceTypes).length), 0)
  );

  const response = await generateLLMResponse({
    systemPrompt: `
You are an autonomous network fault investigation planner.
Choose the next diagnostic agent based only on available evidence.
Select ONLY an exact agent ID and capability ID from the supplied availableAgents.
Copy requestedEvidence identifiers EXACTLY from the selected capability's evidenceTypes.
Never invent, abbreviate, or rename agent IDs, capability IDs, or evidence identifiers.
Never select a completed or failed agent.
If no further investigation is useful, choose stop.
Return JSON only:
{
  "action": "dispatch" or "stop",
  "agentId": "exact registered agent ID",
  "capabilityId": "exact registered capability ID",
  "requestedEvidence": ["exact supported evidence type"],
  "rationale": "brief explanation"
}
`,
    userPrompt: JSON.stringify({
      incidentId: input.incidentId,
      telemetry: input.telemetry,
      findings: input.findings,
      missingEvidence: input.missingEvidence,
      completedAgents: input.completedAgents,
      failedAgents: input.failedAgents ?? [],
      step: input.step,
      maxSteps,
      availableAgents,
    }),
    temperature: 0.1,
  });

  const plan = parseLLMJson<InvestigationPlan>(response.content);

  if (
    !plan ||
    typeof plan !== "object" ||
    !["dispatch", "stop"].includes(plan.action) ||
    typeof plan.rationale !== "string" ||
    !plan.rationale.trim()
  ) {
    throw new Error("Planner returned an invalid investigation plan.");
  }

  if (plan.action === "stop") {
    return { action: "stop", rationale: plan.rationale };
  }

  // Preserve valid LLM choices. Recover invalid IDs using telemetry coverage.
  const selectedAgent =
    availableAgents.find((agent) => agent.id === plan.agentId) ??
    rankedAgents[0];

  const selectedCapability =
    selectedAgent.capabilities.find(
      (capability) => capability.id === plan.capabilityId
    ) ?? [...selectedAgent.capabilities].sort(
      (a, b) => coverage(b.evidenceTypes).length - coverage(a.evidenceTypes).length
    )[0];

  if (!selectedCapability) {
    throw new Error(`No registered capability available for ${selectedAgent.id}.`);
  }

  const allowedEvidence = new Set(selectedCapability.evidenceTypes);
  const validRequestedEvidence = Array.isArray(plan.requestedEvidence)
    ? [...new Set(
        plan.requestedEvidence.filter(
          (item): item is string =>
            typeof item === "string" && allowedEvidence.has(item)
        )
      )]
    : [];

  const requestedEvidence =
    validRequestedEvidence.length > 0
      ? validRequestedEvidence
      : coverage(selectedCapability.evidenceTypes).length > 0
        ? coverage(selectedCapability.evidenceTypes)
        : [...selectedCapability.evidenceTypes];

  const usedFallback =
    selectedAgent.id !== plan.agentId ||
    selectedCapability.id !== plan.capabilityId;

  return {
    action: "dispatch",
    agentId: selectedAgent.id,
    capabilityId: selectedCapability.id,
    requestedEvidence,
    rationale: usedFallback
      ? `Planner selection was not registered; selected ${selectedAgent.id} using available telemetry coverage. ${plan.rationale}`
      : plan.rationale,
  };
}
