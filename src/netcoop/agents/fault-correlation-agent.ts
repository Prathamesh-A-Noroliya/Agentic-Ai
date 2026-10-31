import type { EvidenceFinding } from "../types";

export function runFaultCorrelationAgent(
  findings: EvidenceFinding[]
): EvidenceFinding {
  const evidence = findings.flatMap((finding) =>
    finding.evidence.map((item) => ({
      agent: finding.agent,
      text: item,
    }))
  );

  const categories = [
    { name: "performance degradation", pattern: /latency|jitter|packet loss|throughput/i },
    { name: "infrastructure stress", pattern: /cpu|memory|queue drop|interface error|utilization/i },
    { name: "connectivity degradation", pattern: /connectivity|reachability|interface instability/i },
  ];

  const detected = categories.filter((category) =>
    evidence.some((item) => category.pattern.test(item.text))
  );

  const sources = [...new Set(evidence.map((item) => item.agent))];

  const observation = detected.length
    ? `Correlated ${detected.map((item) => item.name).join(", ")} across ${sources.length} evidence source(s). Correlation indicates a relationship worth investigating, not proven causation.`
    : "No overlapping fault categories identified from available evidence.";

  return {
    agent: "fault-correlation-agent",
    observation,
    evidence: detected.length ? [observation] : [],
    limitations: [
      "Correlated symptoms do not independently establish root cause.",
      ...(sources.length < 2
        ? ["Insufficient independent evidence sources for cross-agent correlation."]
        : []),
    ],
  };
}
