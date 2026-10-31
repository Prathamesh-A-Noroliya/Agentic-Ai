import { runPerformanceAgent } from "./src/netcoop/agents/performance-agent";
import type { NetworkTelemetry } from "./src/netcoop/types";

const incident: NetworkTelemetry = {
  incident_id: "INC-001",
  device: "Core-Router-01",
  timestamp: "2026-10-31T10:30:00Z",
  metrics: {
    latency_ms: 250,
    packet_loss_percent: 12,
    jitter_ms: 45,
    cpu_utilization_percent: 95,
  },
};

const result = runPerformanceAgent(incident);

console.log("\n=== NETCOOP AI: PERFORMANCE AGENT ===\n");
console.log(JSON.stringify(result, null, 2));
