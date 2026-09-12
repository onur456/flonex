import { NextResponse, type NextRequest } from "next/server";
import {
  acceptsMediaType,
  findSocialPlatform,
  isSocialPlatform,
  type PublishTargetResult,
  type SocialMediaType,
  type SocialPlatform,
} from "@/lib/social";
import { listSocialAccounts } from "@/lib/socialStore";
import { getRequestAuth } from "@/lib/supabaseRequest";

export const runtime = "nodejs";

/** Сколько «думает» заглушка, чтобы в UI успел показаться спиннер. */
const MOCK_LATENCY_MS = 700;

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readPlatforms(value: unknown): SocialPlatform[] | null {
  if (!Array.isArray(value)) return null;

  const platforms = value.filter(isSocialPlatform);
  if (platforms.length === 0 || platforms.length !== value.length) return null;

  return Array.from(new Set(platforms));
}

function readMediaType(value: unknown): SocialMediaType | null {
  return value === "image" || value === "video" ? value : null;
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Заглушка публикации. Реальная реализация должна складывать задание в очередь
 * (Instagram Graph API и TikTok Content Posting API работают асинхронно) и
 * отдавать клиенту id задания, а не готовый permalink.
 */
export async function POST(request: NextRequest) {
  const auth = await getRequestAuth(request);

  if (!auth) {
    return NextResponse.json(
      { error: "Войдите в аккаунт, чтобы публиковать" },
      { status: 401 }
    );
  }

  const body = asRecord(await request.json().catch(() => ({})));

  const mediaUrl = body.mediaUrl;
  const mediaType = readMediaType(body.mediaType);
  const platforms = readPlatforms(body.platforms);
  const caption = typeof body.caption === "string" ? body.caption.trim() : "";
  const scheduledAtRaw = body.scheduledAt;

  if (!isHttpUrl(mediaUrl)) {
    return NextResponse.json(
      { error: "mediaUrl должен быть http(s)-ссылкой" },
      { status: 400 }
    );
  }

  if (!mediaType) {
    return NextResponse.json(
      { error: "mediaType должен быть image или video" },
      { status: 400 }
    );
  }

  if (!platforms) {
    return NextResponse.json(
      { error: "Выберите хотя бы одну платформу" },
      { status: 400 }
    );
  }

  let scheduledAt: string | null = null;
  if (scheduledAtRaw !== null && scheduledAtRaw !== undefined) {
    if (typeof scheduledAtRaw !== "string") {
      return NextResponse.json(
        { error: "scheduledAt должен быть ISO-строкой или null" },
        { status: 400 }
      );
    }

    const parsed = new Date(scheduledAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "Не удалось разобрать дату публикации" },
        { status: 400 }
      );
    }

    if (parsed.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "Дата публикации должна быть в будущем" },
        { status: 400 }
      );
    }

    scheduledAt = parsed.toISOString();
  }

  let accounts;
  try {
    accounts = await listSocialAccounts(auth.client, auth.userId);
  } catch (error) {
    console.error("[social/publish]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка Supabase" },
      { status: 500 }
    );
  }

  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));

  const results: PublishTargetResult[] = platforms.map((platform) => {
    const meta = findSocialPlatform(platform);
    const account = accounts.find((item) => item.platform === platform);

    if (!account || account.status !== "connected") {
      return {
        platform,
        status: "failed",
        permalink: null,
        error: `${meta.title} не подключён`,
      };
    }

    if (!acceptsMediaType(platform, mediaType)) {
      return {
        platform,
        status: "failed",
        permalink: null,
        error: `${meta.title} не принимает ${mediaType === "video" ? "видео" : "фото"}`,
      };
    }

    if (caption.length > meta.captionLimit) {
      return {
        platform,
        status: "failed",
        permalink: null,
        error: `Подпись длиннее ${meta.captionLimit} символов`,
      };
    }

    return {
      platform,
      status: scheduledAt ? "scheduled" : "published",
      permalink: scheduledAt
        ? null
        : `https://example.com/${platform}/mock-${Date.now()}`,
      error: null,
    };
  });

  return NextResponse.json({
    success: results.some((result) => result.status !== "failed"),
    results,
  });
}
