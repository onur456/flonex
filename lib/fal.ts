const FAL_RUN_URL = "https://fal.run";
const FAL_QUEUE_URL = "https://queue.fal.run";

export const FAL_IMAGE_MODEL = "fal-ai/flux/dev";
export const FAL_IMAGE_TO_IMAGE_MODEL = "fal-ai/flux/dev/image-to-image";
export const FAL_VIDEO_MODEL =
  "fal-ai/kling-video/v1/standard/image-to-video";

export type FalImageSize =
  | "square_hd"
  | "square"
  | "portrait_4_3"
  | "portrait_16_9"
  | "landscape_4_3"
  | "landscape_16_9";

export interface FalFile {
  url: string;
  content_type?: string;
  file_name?: string;
  width?: number;
  height?: number;
}

export interface FalImageResult {
  images?: FalFile[];
  prompt?: string;
}

export interface FalVideoResult {
  video?: FalFile;
}

export class FalRequestError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.name = "FalRequestError";
    this.status = status;
    this.payload = payload;
  }
}

export function getFalKey(): string | null {
  const key = process.env.FAL_KEY?.trim();
  return key || null;
}

export function mapAspectRatioToImageSize(
  aspectRatio: string | undefined
): FalImageSize {
  switch (aspectRatio) {
    case "1:1":
      return "square_hd";
    case "3:4":
      return "portrait_4_3";
    case "9:16":
      return "portrait_16_9";
    case "4:3":
      return "landscape_4_3";
    case "16:9":
      return "landscape_16_9";
    default:
      return "portrait_4_3";
  }
}

export function formatFalErrorPayload(payload: unknown): string {
  if (!payload) return "Unknown Fal.ai error";

  if (typeof payload === "string") return payload;

  if (typeof payload !== "object") {
    return String(payload);
  }

  const data = payload as Record<string, unknown>;
  const detail = data.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const parts = detail.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "msg" in item) {
        const msg = (item as { msg: unknown }).msg;
        const loc = (item as { loc?: unknown }).loc;
        const location = Array.isArray(loc) ? loc.join(".") : "";
        return location ? `${location}: ${String(msg)}` : String(msg);
      }
      return JSON.stringify(item);
    });

    if (parts.length > 0) return parts.join("; ");
  }

  if (typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (typeof data.error === "string" && data.error.trim()) {
    return data.error;
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return "Unknown Fal.ai error";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

function getRequestId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  if (typeof data.request_id === "string" && data.request_id) {
    return data.request_id;
  }
  if (typeof data.requestId === "string" && data.requestId) {
    return data.requestId;
  }
  return null;
}

function hasMediaResult(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const data = payload as Record<string, unknown>;
  if (Array.isArray(data.images) && data.images.length > 0) return true;
  if (data.video && typeof data.video === "object") return true;
  return false;
}

async function pollFalQueue(
  model: string,
  requestId: string,
  falKey: string,
  timeoutMs: number,
  pollMs: number
): Promise<unknown> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const statusResponse = await fetch(
      `${FAL_QUEUE_URL}/${model}/requests/${requestId}/status`,
      {
        headers: {
          Authorization: `Key ${falKey}`,
        },
      }
    );

    const statusPayload = await readJson(statusResponse);

    if (!statusResponse.ok) {
      console.error("[Fal.ai] Queue status error:", statusPayload);
      throw new FalRequestError(
        statusResponse.status,
        `Fal.ai status ${statusResponse.status}: ${formatFalErrorPayload(statusPayload)}`,
        statusPayload
      );
    }

    const status =
      statusPayload && typeof statusPayload === "object"
        ? String((statusPayload as Record<string, unknown>).status ?? "")
        : "";

    if (status === "COMPLETED") {
      const resultResponse = await fetch(
        `${FAL_QUEUE_URL}/${model}/requests/${requestId}`,
        {
          headers: {
            Authorization: `Key ${falKey}`,
          },
        }
      );

      const resultPayload = await readJson(resultResponse);

      if (!resultResponse.ok) {
        console.error("[Fal.ai] Queue result error:", resultPayload);
        throw new FalRequestError(
          resultResponse.status,
          `Fal.ai status ${resultResponse.status}: ${formatFalErrorPayload(resultPayload)}`,
          resultPayload
        );
      }

      return resultPayload;
    }

    if (status === "FAILED") {
      console.error("[Fal.ai] Queue job failed:", statusPayload);
      throw new FalRequestError(
        500,
        `Fal.ai status 500: ${formatFalErrorPayload(statusPayload)}`,
        statusPayload
      );
    }

    await sleep(pollMs);
  }

  throw new FalRequestError(
    504,
    `Fal.ai status 504: generation timed out after ${Math.round(timeoutMs / 1000)}s`
  );
}

export async function runFalModel(
  model: string,
  input: Record<string, unknown>,
  options?: {
    timeoutMs?: number;
    pollMs?: number;
  }
): Promise<unknown> {
  const falKey = getFalKey();

  if (!falKey) {
    console.error("[Fal.ai] FAL_KEY is missing from environment variables");
    throw new FalRequestError(
      500,
      "API ключ FAL_KEY не найден в .env.local"
    );
  }

  const timeoutMs = options?.timeoutMs ?? 120_000;
  const pollMs = options?.pollMs ?? 2_500;

  const response = await fetch(`${FAL_RUN_URL}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = await readJson(response);

  if (!response.ok && response.status !== 202) {
    console.error("[Fal.ai] Request failed:", {
      model,
      status: response.status,
      payload,
    });
    throw new FalRequestError(
      response.status,
      `Fal.ai status ${response.status}: ${formatFalErrorPayload(payload)}`,
      payload
    );
  }

  if (hasMediaResult(payload)) {
    return payload;
  }

  const requestId = getRequestId(payload);
  if (requestId) {
    console.log("[Fal.ai] Polling queue for request:", requestId);
    return pollFalQueue(model, requestId, falKey, timeoutMs, pollMs);
  }

  if (!response.ok) {
    console.error("[Fal.ai] Unexpected non-OK response:", {
      model,
      status: response.status,
      payload,
    });
    throw new FalRequestError(
      response.status,
      `Fal.ai status ${response.status}: ${formatFalErrorPayload(payload)}`,
      payload
    );
  }

  console.error("[Fal.ai] Response did not contain media or request_id:", payload);
  return payload;
}

export function extractImageUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as FalImageResult & { image?: FalFile | string };

  const firstImage = data.images?.[0];
  if (firstImage?.url) return firstImage.url;

  if (data.image && typeof data.image === "object" && data.image.url) {
    return data.image.url;
  }

  if (typeof data.image === "string" && data.image) {
    return data.image;
  }

  return null;
}

export function extractVideoUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as FalVideoResult & { video_url?: string };

  if (data.video?.url) return data.video.url;
  if (typeof data.video_url === "string" && data.video_url) {
    return data.video_url;
  }

  return null;
}

export function pickString(
  body: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

export function asJsonRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
