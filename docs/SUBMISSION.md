# NetCoop AI

## Project
Multi-Agent Network Fault Diagnosis and Interoperability.

## Architecture
- Diagnostic agents: Performance, Infrastructure, Connectivity.
- Reasoning agents: Fault Correlation, Hypothesis, Verification.
- Coordinator: Autonomous investigation orchestration.
- Communication: Structured agent messages and correlated responses.

## Required scenarios
1. Normal network operation.
2. Link congestion.
3. Weak Wi-Fi signal.
4. Ethernet/interface fault.
5. DNS/DHCP failure.
6. Interoperability failure.

## Evaluation requirements
- Evidence-backed hypotheses.
- Competing explanations.
- Independent evidence challenge.
- Versioned communication protocol.
- Malformed-message handling.
- Confidence and uncertainty reporting.
- Reproducible scenario tests.

## Telemetry limitation
Sample telemetry must be distinguished from live device telemetry. Live collection requires a configured monitoring integration.

## Demo
1. Introduce the network incident.
2. Submit telemetry.
3. Show diagnostic agent collaboration.
4. Show hypothesis generation.
5. Show verification and conflicting evidence.
6. Present the final JSON diagnosis.
