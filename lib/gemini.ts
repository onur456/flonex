export const GEMINI_ANALYZE_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
] as const;

export class GeminiRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GeminiRequestError";
    this.status = status;
  }
}

export function isTransientGeminiError(status: number, message: string): boolean {
  if (status === 429 || status === 503) return true;

  const text = message.toLowerCase();
  return (
    text.includes("high demand") ||
    text.includes("resource exhausted") ||
    text.includes("unavailable") ||
    text.includes("overloaded") ||
    text.includes("try again later")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickGeminiMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string" && error.message.trim()) {
      return error.message;
    }
  }

  return `Gemini API Error: ${status}`;
}

/**
 * Calls Gemini generateContent with retries and fallback models so a
 * temporary overload of one model does not fail the whole upload.
 */
export async function generateGeminiContent(options: {
  apiKey: string;
  models?: readonly string[];
  body: Record<string, unknown>;
  attemptsPerModel?: number;
}): Promise<{ result: unknown; model: string }> {
  const models = options.models ?? GEMINI_ANALYZE_MODELS;
  const attemptsPerModel = options.attemptsPerModel ?? 3;
  let lastStatus = 503;
  let lastMessage = "Gemini is temporarily unavailable";

  for (const model of models) {
    for (let attempt = 0; attempt < attemptsPerModel; attempt++) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${options.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options.body),
        }
      );

      const result: unknown = await response.json().catch(() => ({}));

      if (response.ok) {
        return { result, model };
      }

      lastStatus = response.status;
      lastMessage = pickGeminiMessage(result, response.status);

      if (!isTransientGeminiError(response.status, lastMessage)) {
        throw new GeminiRequestError(response.status, lastMessage);
      }

      console.warn("[Gemini] Transient error, retrying", {
        model,
        attempt: attempt + 1,
        status: response.status,
        message: lastMessage,
      });

      await sleep(Math.min(700 * 2 ** attempt, 4000));
    }
  }

  throw new GeminiRequestError(lastStatus, lastMessage);
}
