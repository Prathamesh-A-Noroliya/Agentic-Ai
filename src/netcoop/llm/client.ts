import OpenAI from "openai";

export type LLMProvider = "ollama" | "openai-compatible";

export interface LLMResponse {
  content: string;
  provider: LLMProvider;
  model: string;
}

function getLLMConfig() {
  const provider = (
    process.env.LLM_PROVIDER ?? "openai-compatible"
  ) as LLMProvider;

  if (
    provider !== "ollama" &&
    provider !== "openai-compatible"
  ) {
    throw new Error("Unsupported LLM provider.");
  }

  const baseURL =
    process.env.LLM_BASE_URL ??
    (provider === "ollama"
      ? "http://localhost:11434/v1"
      : "https://api.openai.com/v1");

  const apiKey =
    process.env.LLM_API_KEY ??
    (provider === "ollama"
      ? "ollama"
      : process.env.OPENAI_API_KEY);

  const model =
    process.env.LLM_MODEL ??
    (provider === "ollama"
      ? "qwen2.5:3b"
      : "gpt-4.1-mini");

  if (!apiKey || !baseURL) {
    throw new Error(
      "LLM configuration is incomplete. Check server environment variables."
    );
  }

  return { provider, baseURL, apiKey, model };
}

export async function generateLLMResponse(input: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}): Promise<LLMResponse> {
  const config = getLLMConfig();

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    timeout: 60000,
    maxRetries: 1,
  });

  const result = await client.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: "system",
        content: input.systemPrompt,
      },
      {
        role: "user",
        content: input.userPrompt,
      },
    ],
    temperature: input.temperature ?? 0.2,
  });

  const content = result.choices[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("LLM returned an empty response.");
  }

  return {
    content,
    provider: config.provider,
    model: config.model,
  };
}

export function parseLLMJson<T>(content: string): T {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(
      "LLM returned invalid JSON. Please retry the investigation."
    );
  }
}
