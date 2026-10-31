import { NextResponse } from "next/server";
import { validateTelemetry } from "@/src/netcoop/telemetry";
import { runInvestigationCoordinator } from "@/src/netcoop/agents/investigation-coordinator";

export async function GET() {
  return NextResponse.json({
    name: "NetCoop AI Diagnosis API",
    status: "ready",
    mode: "multi-agent-investigation",
    agents: ["performance-agent", "infrastructure-agent", "connectivity-agent", "fault-correlation-agent", "hypothesis-agent", "verification-agent", "coordinator"],
  });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json(
        {
          error: "Unsupported content type.",
          message: "Send the request using application/json.",
        },
        { status: 415 }
      );
    }

    const rawBody = await request.text();

    if (rawBody.length > 100_000) {
      return NextResponse.json(
        { error: "Request body exceeds the 100 KB limit." },
        { status: 413 }
      );
    }

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Unable to read request body." },
      { status: 400 }
    );
  }

  const validation = validateTelemetry(body);

  if (!validation.valid) {
    return NextResponse.json(
      {
        error: "Telemetry validation failed.",
        issues: validation.issues,
      },
      { status: 400 }
    );
  }

  try {
    const report = await runInvestigationCoordinator(validation.data);

    return NextResponse.json(
      {
        message: "Investigation executed successfully.",
        incident: validation.data,
        investigation: {
          status: "completed",
          agents_executed: [...new Set([...report.findings.map((finding) => finding.agent), ...(report.hypotheses.length ? ["hypothesis-agent"] : []), ...(report.verifications.length ? ["verification-agent"] : []), "coordinator"])],
          report,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "NetCoop AI investigation failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      {
        error: "Investigation execution failed.",
        message:
          error instanceof Error
            ? error.message
            : "The coordinator could not complete the investigation.",
      },
      { status: 500 }
    );
  }
}
