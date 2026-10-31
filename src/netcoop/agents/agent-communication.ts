
import type {
  AgentId,
  AgentMessage,
} from "../types";

const SUPPORTED_PROTOCOL_VERSION = "1.0";

const VALID_AGENTS: AgentId[] = [
  "performance-agent",
  "infrastructure-agent",
  "connectivity-agent",
  "fault-correlation-agent",
  "hypothesis-agent",
  "verification-agent",
  "coordinator",
];

const VALID_MESSAGE_TYPES = [
  "finding",
  "hypothesis",
  "verification",
  "request",
  "response",
] as const;

const MAX_MESSAGES_PER_INVESTIGATION = 5000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string")
  );
}

/**
 * Creates a structured message for communication between agents.
 */
export function createAgentMessage(input: {
  incidentId: string;
  sender: AgentId;
  recipient: AgentId;
  messageType: AgentMessage["message_type"];
  payload: AgentMessage["payload"];
  correlationId?: string;
}): AgentMessage {
  return {
    protocol_version: SUPPORTED_PROTOCOL_VERSION,
    message_id: crypto.randomUUID(),
    ...(input.correlationId ? { correlation_id: input.correlationId } : {}),
    incident_id: input.incidentId,
    sender: input.sender,
    recipient: input.recipient,
    message_type: input.messageType,
    timestamp: new Date().toISOString(),
    payload: input.payload,
  };
}

/**
 * Validates an incoming message at runtime.
 * Treat messages as untrusted, even when TypeScript types exist.
 */
export function validateAgentMessage(
  input: unknown,
  expectedIncidentId: string
): string[] {
  const issues: string[] = [];

  if (!isRecord(input)) {
    return ["Message must be a valid object."];
  }

  if (input.protocol_version !== SUPPORTED_PROTOCOL_VERSION) {
    issues.push("Unsupported agent protocol version.");
  }

  if (
    typeof input.message_id !== "string" ||
    input.message_id.trim().length === 0 ||
    input.message_id.length > 128
  ) {
    issues.push("Message ID is missing or invalid.");
  }

  if (
    input.correlation_id !== undefined &&
    (
      typeof input.correlation_id !== "string" ||
      input.correlation_id.trim().length === 0 ||
      input.correlation_id.length > 128
    )
  ) {
    issues.push("Correlation ID is invalid.");
  }

  if (
    typeof input.incident_id !== "string" ||
    input.incident_id !== expectedIncidentId
  ) {
    issues.push("Message incident ID does not match the active incident.");
  }

  if (
    typeof input.sender !== "string" ||
    !VALID_AGENTS.includes(input.sender as AgentId)
  ) {
    issues.push("Invalid message sender.");
  }

  if (
    typeof input.recipient !== "string" ||
    !VALID_AGENTS.includes(input.recipient as AgentId)
  ) {
    issues.push("Invalid message recipient.");
  }

  if (
    typeof input.message_type !== "string" ||
    !(VALID_MESSAGE_TYPES as readonly string[]).includes(
      input.message_type
    )
  ) {
    issues.push("Invalid message type.");
  }

  if (
    typeof input.timestamp !== "string" ||
    !Number.isFinite(Date.parse(input.timestamp))
  ) {
    issues.push("Message timestamp is invalid.");
  }

  if (!isRecord(input.payload)) {
    issues.push("Message payload must be an object.");
    return issues;
  }

  const payload = input.payload;

  if (!isStringArray(payload.evidence)) {
    issues.push("Evidence must be an array of strings.");
  }

  if (!isStringArray(payload.limitations)) {
    issues.push("Limitations must be an array of strings.");
  }

  for (const field of [
    "observation",
    "hypothesis",
    "verdict",
  ]) {
    if (
      payload[field] !== undefined &&
      typeof payload[field] !== "string"
    ) {
      issues.push(`${field} must be a string.`);
    }
  }

  if (
    payload.requested_data !== undefined &&
    !isStringArray(payload.requested_data)
  ) {
    issues.push("Requested data must be an array of strings.");
  }

  if (
    payload.confidence !== undefined &&
    (
      typeof payload.confidence !== "number" ||
      !Number.isFinite(payload.confidence) ||
      payload.confidence < 0 ||
      payload.confidence > 1
    )
  ) {
    issues.push("Confidence must be a number between 0 and 1.");
  }

  return issues;
}

/**
 * In-memory message bus for one investigation.
 * This is process-local, not persistent or distributed.
 */
export class AgentMessageBus {
  private readonly messages: AgentMessage[] = [];
  private readonly messageIds = new Set<string>();

  constructor(private readonly incidentId: string) {
    if (!incidentId.trim()) {
      throw new Error("An incident ID is required.");
    }
  }

  /**
   * Validates and stores a message.
   */
  send(message: AgentMessage): void {
    const issues = validateAgentMessage(message, this.incidentId);

    if (issues.length > 0) {
      throw new Error(
        `Invalid agent message: ${issues.join(" ")}`
      );
    }

    if (this.messageIds.has(message.message_id)) {
      throw new Error(
        `Duplicate message ID: ${message.message_id}`
      );
    }

    if (this.messages.length >= MAX_MESSAGES_PER_INVESTIGATION) {
      throw new Error("Investigation message limit reached.");
    }

    // Store a copy so the sender cannot modify the stored message.
    const safeMessage = structuredClone(message);

    this.messages.push(safeMessage);
    this.messageIds.add(message.message_id);
  }

  getMessages(): AgentMessage[] {
    return structuredClone(this.messages);
  }

  getMessagesFor(agent: AgentId): AgentMessage[] {
    return structuredClone(
      this.messages.filter(
        (message) => message.recipient === agent
      )
    );
  }

  getMessagesFrom(agent: AgentId): AgentMessage[] {
    return structuredClone(
      this.messages.filter(
        (message) => message.sender === agent
      )
    );
  }
}
