
import { NextResponse } from "next/server";
import { generateLLMResponse } from "@/src/netcoop/llm/client";

const INSTRUCTIONS = [
  "You are NetCoop AI, an AI assistant for network fault diagnosis.",
  "Answer analysts clearly and dynamically.",
  "Never invent telemetry, measurements, logs, or investigation results.",
  "Distinguish observed facts from hypotheses and recommendations.",
  "If incident evidence is missing, explain what evidence is needed.",
  "Never claim to have executed diagnostic tools that were not run.",
  "Explain uncertainty when discussing possible root causes.",
].join(" ");

export async function GET() {
  return NextResponse.json({
    name: "NetCoop AI Chat API",
    status: "ready",
    message: "LLM provider configuration is managed server-side.",
  });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must contain valid JSON." },
      { status: 400 }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("message" in body) ||
    typeof body.message !== "string" ||
    body.message.trim().length === 0
  ) {
    return NextResponse.json(
      { error: "Provide a non-empty message string." },
      { status: 400 }
    );
  }

  if (body.message.length > 4000) {
    return NextResponse.json(
      { error: "Message must be 4000 characters or fewer." },
      { status: 400 }
    );
  }

  try {
    const result = await generateLLMResponse({
      systemPrompt: INSTRUCTIONS,
      userPrompt: body.message.trim(),
      temperature: 0.2,
    });

    return NextResponse.json(
      {
        answer: result.content,
        provider: result.provider,
        model: result.model,
        local: result.provider === "ollama",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "NetCoop AI LLM request failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      {
        error: "The AI model could not complete the request.",
        message:
          "Check your LLM provider configuration, model availability, and API credentials.",
      },
      { status: 502 }
    );
  }
}
