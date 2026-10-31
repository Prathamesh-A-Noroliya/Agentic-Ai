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

export function validateTelemetry(
  input: unknown
): { valid: true; data: NetworkTelemetry } | {
  valid: false;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      valid: false,
      issues: [{ field: "body", message: "Expected a JSON object." }],
    };
  }

  const value = input as Record<string, unknown>;

  if (typeof value.incident_id !== "string" || !value.incident_id.trim()) {
    issues.push({
      field: "incident_id",
      message: "A non-empty incident_id is required.",
    });
  } else if (value.incident_id.length > 100) {
    issues.push({
      field: "incident_id",
      message: "incident_id must be at most 100 characters.",
    });
  }

  if (typeof value.device !== "string" || !value.device.trim()) {
    issues.push({
      field: "device",
      message: "A non-empty device name is required.",
    });
  } else if (value.device.length > 200) {
    issues.push({
      field: "device",
      message: "device must be at most 200 characters.",
    });
  }

  if (
    value.timestamp !== undefined &&
    (typeof value.timestamp !== "string" ||
      !Number.isFinite(Date.parse(value.timestamp)))
  ) {
    issues.push({
      field: "timestamp",
      message: "timestamp must be a valid date-time string.",
    });
  }

  if (
    typeof value.metrics !== "object" ||
    value.metrics === null ||
    Array.isArray(value.metrics)
  ) {
    issues.push({
      field: "metrics",
      message: "metrics must be a JSON object.",
    });
  } else {
    const metrics = value.metrics as Record<string, unknown>;

    for (const [name, raw] of Object.entries(metrics)) {
      const limits = numericLimits[name];

      if (!limits) {
        issues.push({
          field: `metrics.${name}`,
          message: "Unknown metric. Use a supported metric name.",
        });
        continue;
      }

      if (typeof raw !== "number" || !Number.isFinite(raw)) {
        issues.push({
          field: `metrics.${name}`,
          message: "Metric must be a finite number.",
        });
        continue;
      }

      if (raw < limits.min || raw > limits.max) {
        issues.push({
          field: `metrics.${name}`,
          message: `Metric must be between ${limits.min} and ${limits.max}.`,
        });
      }

      if (
        Number.isSafeInteger(limits.max) &&
        raw >= 0 &&
        !Number.isSafeInteger(raw)
      ) {
        issues.push({
          field: `metrics.${name}`,
          message: "Counter metrics must be safe integers.",
        });
      }
    }
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }

  const metrics = value.metrics as NetworkTelemetry["metrics"];

  return {
    valid: true,
    data: {
      incident_id: (value.incident_id as string).trim(),
      device: (value.device as string).trim(),
      ...(value.timestamp !== undefined
        ? { timestamp: value.timestamp as string }
        : {}),
      metrics: { ...metrics },
    },
  };
}
