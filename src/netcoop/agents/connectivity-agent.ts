import type { NetworkTelemetry, EvidenceFinding } from "../types";

export function runConnectivityAgent(
  telemetry: NetworkTelemetry
): EvidenceFinding {
  const metrics = telemetry.metrics;
  const evidence: string[] = [];
  const limitations: string[] = [];
  const observations: string[] = [];

  if (metrics.packet_loss_percent !== undefined) {
    if (metrics.packet_loss_percent > 2) {
      evidence.push(`Connectivity: Packet loss is ${metrics.packet_loss_percent}%.`);
      observations.push("Elevated packet loss indicates degraded device-level connectivity.");
    } else {
      evidence.push(`Connectivity: Packet loss is ${metrics.packet_loss_percent}%.`);
    }
  } else {
    limitations.push("Packet-loss telemetry is unavailable.");
  }

  if (metrics.latency_ms !== undefined) {
    if (metrics.latency_ms > 100) {
      evidence.push(`Connectivity: Latency is ${metrics.latency_ms} ms.`);
      observations.push("Elevated latency indicates possible path or device-level performance degradation.");
    } else {
      evidence.push(`Connectivity: Latency is ${metrics.latency_ms} ms.`);
    }
  } else {
    limitations.push("Latency telemetry is unavailable.");
  }

  if (metrics.interface_errors !== undefined) {
    if (metrics.interface_errors > 0) {
      evidence.push(`Connectivity: Interface errors count is ${metrics.interface_errors}.`);
      observations.push("Interface errors may contribute to connectivity instability.");
    } else {
      evidence.push("Connectivity: No interface errors were reported in this snapshot.");
    }
  } else {
    limitations.push("Interface error counters are unavailable.");
  }

  limitations.push(
    "Network topology, neighbouring devices, and end-to-end reachability data were not supplied; affected network paths cannot be established."
  );

  return {
    agent: "connectivity-agent",
    observation: observations.length > 0
      ? observations.join(" ")
      : "No elevated connectivity symptoms were identified in the available device-level metrics. This does not prove end-to-end reachability.",
    evidence,
    limitations,
  };
}
