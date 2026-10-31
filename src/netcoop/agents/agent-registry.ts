import type { AgentId } from "../types";

export type AgentExecutionMode = "sync" | "async";

export interface AgentCapability {
  id: string;
  description: string;
  evidenceTypes: string[];
}

export interface AgentRegistration {
  id: AgentId;
  name: string;
  role: "diagnostic" | "reasoning" | "coordination";
  executionMode: AgentExecutionMode;
  capabilities: AgentCapability[];
}

export const AGENT_REGISTRY: readonly AgentRegistration[] = [
  {
    id: "performance-agent",
    name: "Performance Agent",
    role: "diagnostic",
    executionMode: "sync",
    capabilities: [
      {
        id: "performance_analysis",
        description: "Analyze network latency, packet loss, jitter and bandwidth measurements.",
        evidenceTypes: ["latency_ms", "packet_loss_percent", "jitter_ms", "bandwidth_mbps"],
      },
    ],
  },
  {
    id: "infrastructure-agent",
    name: "Infrastructure Agent",
    role: "diagnostic",
    executionMode: "sync",
    capabilities: [
      {
        id: "infrastructure_analysis",
        description: "Analyze device resource utilization and network interface health.",
        evidenceTypes: [
          "cpu_utilization_percent",
          "memory_utilization_percent",
          "utilization_percent",
          "interface_errors",
          "queue_drops",
        ],
      },
    ],
  },
  {
    id: "connectivity-agent",
    name: "Connectivity Agent",
    role: "diagnostic",
    executionMode: "sync",
    capabilities: [
      {
        id: "connectivity_analysis",
        description: "Analyze connectivity symptoms and identify missing topology or reachability evidence.",
        evidenceTypes: ["latency_ms", "packet_loss_percent", "interface_errors", "topology", "reachability"],
      },
    ],
  },
  {
    id: "fault-correlation-agent",
    name: "Fault Correlation Agent",
    role: "reasoning",
    executionMode: "sync",
    capabilities: [
      {
        id: "cross_agent_correlation",
        description: "Correlate evidence from multiple diagnostic agents without treating correlation as causation.",
        evidenceTypes: ["agent_findings", "cross_domain_evidence"],
      },
    ],
  },
  {
    id: "hypothesis-agent",
    name: "Hypothesis Agent",
    role: "reasoning",
    executionMode: "async",
    capabilities: [
      {
        id: "root_cause_hypothesis",
        description: "Generate competing evidence-grounded root-cause hypotheses.",
        evidenceTypes: ["agent_findings", "evidence_catalog"],
      },
    ],
  },
  {
    id: "verification-agent",
    name: "Verification Agent",
    role: "reasoning",
    executionMode: "async",
    capabilities: [
      {
        id: "hypothesis_verification",
        description: "Challenge hypotheses using supporting, contradicting and missing evidence.",
        evidenceTypes: ["hypotheses", "agent_findings", "evidence_catalog"],
      },
    ],
  },
];

export function getRegisteredAgents(): AgentRegistration[] {
  return AGENT_REGISTRY.map((agent) => ({
    ...agent,
    capabilities: agent.capabilities.map((capability) => ({
      ...capability,
      evidenceTypes: [...capability.evidenceTypes],
    })),
  }));
}

export function getAgentRegistration(
  agentId: AgentId
): AgentRegistration | undefined {
  return getRegisteredAgents().find((agent) => agent.id === agentId);
}

export function findAgentsForEvidence(
  evidenceTypes: string[]
): AgentRegistration[] {
  const requested = new Set(evidenceTypes);

  return getRegisteredAgents().filter((agent) =>
    agent.capabilities.some((capability) =>
      capability.evidenceTypes.some((type) => requested.has(type))
    )
  );
}
