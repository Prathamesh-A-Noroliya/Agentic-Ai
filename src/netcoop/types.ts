
export interface NetworkTelemetry {
  incident_id: string;
  device: string;
  timestamp?: string;
  metrics: {
    latency_ms?: number;
    packet_loss_percent?: number;
    jitter_ms?: number;
    bandwidth_mbps?: number;
    utilization_percent?: number;
    cpu_utilization_percent?: number;
    memory_utilization_percent?: number;
    interface_errors?: number;
    queue_drops?: number;
  };
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface EvidenceFinding {
  agent: string;
  observation: string;
  evidence: string[];
  limitations: string[];
}

export interface EvidenceReference {
  id: string;
  agent: string;
  statement: string;
}

export interface DiagnosisHypothesis {
  id: string;
  explanation: string;
  supporting_evidence: string[];
  contradicting_evidence: string[];
  missing_evidence: string[];
  confidence: number;
}

export type VerificationVerdict =
  | "supported"
  | "challenged"
  | "inconclusive";

export interface DiagnosisVerification {
  hypothesis_id: string;
  verdict: VerificationVerdict;
  supporting_evidence: string[];
  contradicting_evidence: string[];
  missing_evidence: string[];
  reasoning: string;
  confidence: number;
}

export type DiagnosisStatus =
  | "probable_cause"
  | "multiple_plausible_causes"
  | "insufficient_evidence"
  | "no_fault_detected";

export interface DiagnosisReport {
  incident_id: string;
  device: string;
  status: DiagnosisStatus;
  summary: string;
  suspected_root_cause: string;
  confidence: number;
  affected_devices: string[];
  supporting_evidence: {
    metric: string;
    value: string;
    interpretation: string;
  }[];
  alternative_causes: string[];
  recommended_actions: string[];
  evidence_sources: string[];

  // Original observations from diagnostic agents
  findings: EvidenceFinding[];

  // Traceable evidence and AI assessments
  evidence_catalog: EvidenceReference[];
  hypotheses: DiagnosisHypothesis[];
  verifications: DiagnosisVerification[];

  missing_evidence: string[];
  limitations: string[];
  recommendations: string[];
  generated_at: string;
}

// Shared communication protocol for NetCoop AI agents

export type AgentId =
  | "performance-agent"
  | "infrastructure-agent"
  | "connectivity-agent"
  | "fault-correlation-agent"
  | "hypothesis-agent"
  | "verification-agent"
  | "coordinator";

export type AgentMessageType =
  | "finding"
  | "hypothesis"
  | "verification"
  | "request"
  | "response";

export interface AgentMessage {
  protocol_version: "1.0";
  message_id: string;
  correlation_id?: string;
  incident_id: string;
  sender: AgentId;
  recipient: AgentId;
  message_type: AgentMessageType;
  timestamp: string;
  payload: {
    observation?: string;
    hypothesis?: string;
    verdict?: string;
    evidence: string[];
    limitations: string[];
    confidence?: number;
    requested_data?: string[];
  };
}

