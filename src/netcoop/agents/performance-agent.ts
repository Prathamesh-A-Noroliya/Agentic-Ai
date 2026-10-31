import type {
  EvidenceFinding,
  NetworkTelemetry,
} from "../types";

export function runPerformanceAgent(
  telemetry: NetworkTelemetry
): EvidenceFinding {
  const metrics = telemetry.metrics;
  const evidence: string[] = [];
  const limitations: string[] = [];
  const observations: string[] = [];

  if (metrics.latency_ms === undefined) {
    limitations.push("Latency data is missing.");
  } else if (metrics.latency_ms >= 150) {
    observations.push("Elevated latency detected.");
    evidence.push(
      `Observed latency: ${metrics.latency_ms} ms (investigation threshold: 150 ms).`
    );
  } else {
    evidence.push(
      `Observed latency: ${metrics.latency_ms} ms (below the 150 ms investigation threshold).`
    );
  }

  if (metrics.packet_loss_percent === undefined) {
    limitations.push("Packet-loss data is missing.");
  } else if (metrics.packet_loss_percent >= 2) {
    observations.push("Elevated packet loss detected.");
    evidence.push(
      `Observed packet loss: ${metrics.packet_loss_percent}% (investigation threshold: 2%).`
    );
  } else {
    evidence.push(
      `Observed packet loss: ${metrics.packet_loss_percent}% (below the 2% investigation threshold).`
    );
  }

  if (metrics.jitter_ms === undefined) {
    limitations.push("Jitter data is missing.");
  } else if (metrics.jitter_ms >= 30) {
    observations.push("Elevated jitter detected.");
    evidence.push(
      `Observed jitter: ${metrics.jitter_ms} ms (investigation threshold: 30 ms).`
    );
  } else {
    evidence.push(
      `Observed jitter: ${metrics.jitter_ms} ms (below the 30 ms investigation threshold).`
    );
  }

  if (metrics.bandwidth_mbps === undefined) {
    limitations.push(
      "Bandwidth measurements are missing; throughput adequacy cannot be assessed."
    );
  } else {
    evidence.push(
      `Reported bandwidth: ${metrics.bandwidth_mbps} Mbps.`
    );
    limitations.push(
      "No configured link capacity or expected throughput baseline was provided, so bandwidth adequacy cannot be determined."
    );
  }

  if (observations.length === 0) {
    observations.push(
      "No elevated latency, packet loss, or jitter was detected among the available measurements."
    );
  }

  return {
    agent: "Performance Agent",
    observation: observations.join(" "),
    evidence,
    limitations,
  };
}
