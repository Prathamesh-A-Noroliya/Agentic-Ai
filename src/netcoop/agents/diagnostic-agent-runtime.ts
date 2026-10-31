import type {
  AgentMessage,
  AgentId,
  EvidenceFinding,
  NetworkTelemetry,
} from "../types";

import {
  AgentMessageBus,
  createAgentMessage,
} from "./agent-communication";

import { runPerformanceAgent } from "./performance-agent";
import { runInfrastructureAgent } from "./infrastructure-agent";
import { runConnectivityAgent } from "./connectivity-agent";

type DiagnosticAgentId =
  | "performance-agent"
  | "infrastructure-agent"
  | "connectivity-agent";

const handlers: Record<
  DiagnosticAgentId,
  (telemetry: NetworkTelemetry) => EvidenceFinding
> = {
  "performance-agent": runPerformanceAgent,
  "infrastructure-agent": runInfrastructureAgent,
  "connectivity-agent": runConnectivityAgent,
};


export function selectDiagnosticAgentOrder(
  telemetry: NetworkTelemetry
): DiagnosticAgentId[] {
  const metrics = telemetry.metrics;
  const performanceCoverage = [
    metrics.latency_ms, metrics.packet_loss_percent, metrics.jitter_ms,
    metrics.bandwidth_mbps,
  ].filter((value) => value !== undefined).length;
  const infrastructureCoverage = [
    metrics.cpu_utilization_percent, metrics.memory_utilization_percent,
    metrics.utilization_percent, metrics.interface_errors, metrics.queue_drops,
  ].filter((value) => value !== undefined).length;
  const connectivityCoverage = [
    metrics.latency_ms, metrics.packet_loss_percent, metrics.interface_errors,
  ].filter((value) => value !== undefined).length;

  const scores: Record<DiagnosticAgentId, number> = {
    "performance-agent": performanceCoverage,
    "infrastructure-agent": infrastructureCoverage,
    "connectivity-agent": connectivityCoverage,
  };

  // Investigate the best-covered domain first; retain all agents so missing
  // measurements are explicitly surfaced rather than silently ignored.
  return (Object.keys(scores) as DiagnosticAgentId[]).sort(
    (a, b) => scores[b] - scores[a] || a.localeCompare(b)
  );
}

export function handleDiagnosticAgentRequest(input: {
  request: AgentMessage;
  telemetry: NetworkTelemetry;
  messageBus: AgentMessageBus;
}): EvidenceFinding {
  const { request, telemetry, messageBus } = input;

  if (
    request.message_type !== "request" ||
    request.sender !== "coordinator" ||
    request.incident_id !== telemetry.incident_id
  ) {
    throw new Error("Invalid diagnostic agent request.");
  }

  const recipient = request.recipient as AgentId;

  if (
    recipient !== "performance-agent" &&
    recipient !== "infrastructure-agent" &&
    recipient !== "connectivity-agent"
  ) {
    throw new Error(`Unsupported diagnostic agent: ${recipient}`);
  }

  const handler = handlers[recipient];
  const finding = handler(telemetry);

  if (
    !finding ||
    typeof finding.observation !== "string" ||
    !Array.isArray(finding.evidence) ||
    !Array.isArray(finding.limitations)
  ) {
    throw new Error(`${recipient} returned an invalid finding.`);
  }

  const response = createAgentMessage({
    incidentId: telemetry.incident_id,
    sender: recipient,
    recipient: "coordinator",
    messageType: "response",
    correlationId: request.message_id,
    payload: {
      observation: finding.observation,
      evidence: finding.evidence,
      limitations: finding.limitations,
    },
  });

  messageBus.send(response);

  return finding;
}
