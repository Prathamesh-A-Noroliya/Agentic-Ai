import type {
  AgentId,
  AgentMessage,
  EvidenceFinding,
  NetworkTelemetry,
} from "../types";

import { getAgentRegistration } from "./agent-registry";
import {
  AgentMessageBus,
} from "./agent-communication";
import {
  handleDiagnosticAgentRequest,
} from "./diagnostic-agent-runtime";

const EXECUTABLE_DIAGNOSTIC_AGENTS = new Set<AgentId>([
  "performance-agent",
  "infrastructure-agent",
  "connectivity-agent",
]);

export interface DispatchResult {
  agent: AgentId;
  capability: string;
  finding: EvidenceFinding;
}

export function dispatchDiagnosticAgent(input: {
  request: AgentMessage;
  telemetry: NetworkTelemetry;
  messageBus: AgentMessageBus;
  capabilityId: string;
}): DispatchResult {
  const { request, telemetry, messageBus, capabilityId } = input;
  const agentId = request.recipient;

  if (request.sender !== "coordinator" || request.message_type !== "request") {
    throw new Error("Dispatcher requires a coordinator-originated request.");
  }

  if (request.incident_id !== telemetry.incident_id) {
    throw new Error("Dispatcher rejected an incident ID mismatch.");
  }

  const registration = getAgentRegistration(agentId);

  if (!registration) {
    throw new Error(`Agent is not registered: ${agentId}`);
  }

  if (!EXECUTABLE_DIAGNOSTIC_AGENTS.has(agentId)) {
    throw new Error(
      `Agent ${agentId} is registered but has no diagnostic execution adapter.`
    );
  }

  if (registration.role !== "diagnostic") {
    throw new Error(`Agent ${agentId} is not a diagnostic agent.`);
  }

  const capability = registration.capabilities.find(
    (item) => item.id === capabilityId
  );

  if (!capability) {
    throw new Error(
      `Agent ${agentId} does not support capability ${capabilityId}.`
    );
  }

  const requestedData = request.payload.requested_data ?? [];

  const unsupportedData = requestedData.filter(
    (item) => !capability.evidenceTypes.includes(item)
  );

  if (unsupportedData.length > 0) {
    throw new Error(
      `Agent ${agentId} does not declare support for: ${unsupportedData.join(", ")}.`
    );
  }

  const finding = handleDiagnosticAgentRequest({
    request,
    telemetry,
    messageBus,
  });

  return {
    agent: agentId,
    capability: capability.id,
    finding,
  };
}
