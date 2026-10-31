import type {
  EvidenceFinding,
  NetworkTelemetry,
} from "../types";

export function runInfrastructureAgent(
  telemetry: NetworkTelemetry
): EvidenceFinding {
  const metrics = telemetry.metrics;

  const evidence: string[] = [];
  const observations: string[] = [];
  const limitations: string[] = [];

  if (metrics.cpu_utilization_percent !== undefined) {
    if (metrics.cpu_utilization_percent >= 85) {
      observations.push("High CPU utilization detected.");
      evidence.push(
        `CPU utilization: ${metrics.cpu_utilization_percent}%`
      );
    }
  } else {
    limitations.push("CPU utilization data is unavailable.");
  }

  if (metrics.memory_utilization_percent !== undefined) {
    if (metrics.memory_utilization_percent >= 90) {
      observations.push("High memory utilization detected.");
      evidence.push(
        `Memory utilization: ${metrics.memory_utilization_percent}%`
      );
    }
  } else {
    limitations.push("Memory utilization data is unavailable.");
  }

  if (metrics.utilization_percent !== undefined) {
    if (metrics.utilization_percent >= 85) {
      observations.push("High network-interface utilization detected.");
      evidence.push(
        `Interface utilization: ${metrics.utilization_percent}%`
      );
    }
  } else {
    limitations.push("Network-interface utilization data is unavailable.");
  }

  if (metrics.interface_errors !== undefined) {
    if (metrics.interface_errors > 0) {
      observations.push("Network-interface errors detected.");
      evidence.push(
        `Interface errors: ${metrics.interface_errors}`
      );
    }
  } else {
    limitations.push("Interface error counters are unavailable.");
  }

  if (metrics.queue_drops !== undefined) {
    if (metrics.queue_drops > 0) {
      observations.push("Network queue drops detected.");
      evidence.push(
        `Queue drops: ${metrics.queue_drops}`
      );
    }
  } else {
    limitations.push("Network queue-drop counters are unavailable.");
  }

  return {
    agent: "Infrastructure Agent",
    observation:
      observations.length > 0
        ? observations.join(" ")
        : "No infrastructure threshold breaches detected in the available metrics.",
    evidence,
    limitations: [
      ...limitations,
      "Thresholds are demonstration values, not universal network standards.",
      "A single telemetry snapshot cannot establish the root cause.",
    ],
  };
}
