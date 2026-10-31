import type { NetworkTelemetry, ValidationIssue } from "./types";

const numericLimits: Record<string, { min: number; max: number }> = {
  latency_ms: { min: 0, max: 3_600_000 },
  packet_loss_percent: { min: 0, max: 100 },
  jitter_ms: { min: 0, max: 3_600_000 },
  bandwidth_mbps: { min: 0, max: 1_000_000_000 },
  utilization_percent: { min: 0, max: 100 },
  cpu_utilization_percent: { min: 0, max: 100 },
  memory_utilization_percent: { min: 0, max: 100 },
  interface_errors: { min: 0, max: Number.MAX_SAFE_INTEGER },
  queue_drops: { min: 0, max: Number.MAX_SAFE_INTEGER },
};

const aliases: Record<string, keyof NetworkTelemetry["metrics"]> = {
  latency: "latency_ms",
  latency_ms: "latency_ms",
  latencyMs: "latency_ms",
  rtt_ms: "latency_ms",
  rtt: "latency_ms",
  packet_loss: "packet_loss_percent",
  packetLoss: "packet_loss_percent",
  packetLossPercent: "packet_loss_percent",
  packet_loss_percent: "packet_loss_percent",
  jitter: "jitter_ms",
  jitterMs: "jitter_ms",
  jitter_ms: "jitter_ms",
  bandwidth: "bandwidth_mbps",
  throughput_mbps: "bandwidth_mbps",
  bandwidth_mbps: "bandwidth_mbps",
  utilization: "utilization_percent",
  interface_utilization_percent: "utilization_percent",
  utilization_percent: "utilization_percent",
  cpu: "cpu_utilization_percent",
  cpu_percent: "cpu_utilization_percent",
  cpu_utilization: "cpu_utilization_percent",
  cpu_utilization_percent: "cpu_utilization_percent",
  memory: "memory_utilization_percent",
  memory_percent: "memory_utilization_percent",
  memory_utilization: "memory_utilization_percent",
  memory_utilization_percent: "memory_utilization_percent",
  interface_errors: "interface_errors",
  if_errors: "interface_errors",
  errors: "interface_errors",
  queue_drops: "queue_drops",
  output_drops: "queue_drops",
  drops: "queue_drops",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function convertMetric(value: unknown, metric: keyof NetworkTelemetry["metrics"]):
  | { ok: true; value: number }
  | { ok: false; message: string } {
  let raw = value;
  let unit: string | undefined;

  if (isRecord(value)) {
    raw = value.value;
    unit = typeof value.unit === "string" ? value.unit.trim().toLowerCase() : undefined;
  }

  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return { ok: false, message: "Metric must be a finite number or { value, unit } object." };
  }

  let converted = raw;
  if (unit) {
    const conversions: Partial<Record<string, Record<string, number>>> = {
      latency_ms: { ms: 1, millisecond: 1, milliseconds: 1, s: 1000, sec: 1000, seconds: 1000 },
      jitter_ms: { ms: 1, millisecond: 1, milliseconds: 1, s: 1000, sec: 1000, seconds: 1000 },
      bandwidth_mbps: { mbps: 1, mb: 1, gbps: 1000, kbps: 0.001, bps: 0.000001 },
      packet_loss_percent: { "%": 1, percent: 1, fraction: 100 },
      utilization_percent: { "%": 1, percent: 1, fraction: 100 },
      cpu_utilization_percent: { "%": 1, percent: 1, fraction: 100 },
      memory_utilization_percent: { "%": 1, percent: 1, fraction: 100 },
      interface_errors: { count: 1, errors: 1 },
      queue_drops: { count: 1, packets: 1, drops: 1 },
    };
    const factor = conversions[metric]?.[unit];
    if (factor === undefined) {
      return { ok: false, message: `Unsupported unit '${unit}' for ${metric}.` };
    }
    converted *= factor;
  }

  return { ok: true, value: converted };
}

export function validateTelemetry(
  input: unknown
): { valid: true; data: NetworkTelemetry } | {
  valid: false;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    return { valid: false, issues: [{ field: "body", message: "Expected a JSON object." }] };
  }

  const value = input;
  if (typeof value.incident_id !== "string" || !value.incident_id.trim()) {
    issues.push({ field: "incident_id", message: "A non-empty incident_id is required." });
  } else if (value.incident_id.length > 100) {
    issues.push({ field: "incident_id", message: "incident_id must be at most 100 characters." });
  }

  const device = value.device ?? value.device_id ?? value.hostname ?? value.node;
  if (typeof device !== "string" || !device.trim()) {
    issues.push({ field: "device", message: "A non-empty device, device_id, hostname, or node is required." });
  } else if (device.length > 200) {
    issues.push({ field: "device", message: "device must be at most 200 characters." });
  }

  if (value.timestamp !== undefined &&
      (typeof value.timestamp !== "string" || !Number.isFinite(Date.parse(value.timestamp)))) {
    issues.push({ field: "timestamp", message: "timestamp must be a valid date-time string." });
  }

  const rawMetrics = value.metrics ?? value.telemetry ?? value.measurements;
  if (!isRecord(rawMetrics)) {
    issues.push({ field: "metrics", message: "metrics, telemetry, or measurements must be a JSON object." });
  }

  const normalized: NetworkTelemetry["metrics"] = {};
  if (isRecord(rawMetrics)) {
    const seen = new Set<string>();
    for (const [name, raw] of Object.entries(rawMetrics)) {
      const canonical = aliases[name];
      if (!canonical) {
        issues.push({ field: `metrics.${name}`, message: "Unknown metric alias. Add an explicit schema mapping before ingestion." });
        continue;
      }
      if (seen.has(canonical)) {
        issues.push({ field: `metrics.${name}`, message: `Multiple input fields map to ${canonical}; provide only one to avoid ambiguous telemetry.` });
        continue;
      }
      seen.add(canonical);

      const result = convertMetric(raw, canonical);
      if (!result.ok) {
        issues.push({ field: `metrics.${name}`, message: result.message });
        continue;
      }
      const limits = numericLimits[canonical];
      if (result.value < limits.min || result.value > limits.max) {
        issues.push({ field: `metrics.${name}`, message: `Normalized value must be between ${limits.min} and ${limits.max} (${canonical}).` });
        continue;
      }
      if ((canonical === "interface_errors" || canonical === "queue_drops") &&
          !Number.isSafeInteger(result.value)) {
        issues.push({ field: `metrics.${name}`, message: "Counter metrics must be safe integers." });
        continue;
      }
      normalized[canonical] = result.value;
    }
  }

  if (issues.length) return { valid: false, issues };

  return {
    valid: true,
    data: {
      incident_id: (value.incident_id as string).trim(),
      device: (device as string).trim(),
      ...(value.timestamp !== undefined ? { timestamp: value.timestamp as string } : {}),
      metrics: normalized,
    },
  };
}
