import { NextResponse, type NextRequest } from "next/server";
import {
  FACEBOOK_SCHEDULE_MAX_MS,
  FACEBOOK_SCHEDULE_MIN_MS,
  publishToFacebookPage,
  publishToInstagram,
  type PublishInput,
} from "@/lib/meta";
import {
  acceptsMediaType,
  findSocialPlatform,
  isSocialPlatform,
  type PublishTargetResult,
  type SocialMediaType,
  type SocialPlatform,
} from "@/lib/social";
import { getPublishTargets, updateTikTokTokens, type PublishTarget } from "@/lib/socialStore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getRequestAuth } from "@/lib/supabaseRequest";
import { publishToTikTok, refreshTikTokToken } from "@/lib/tiktok";

export const runtime = "nodejs";

/** Instagram обрабатывает видео асинхронно, и ответа приходится ждать. */
export const maxDuration = 60;

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

function rejected(platform: SocialPlatform, error: string): PublishTargetResult {
  return { platform, status: "failed", permalink: null, error };
}

async function publishToPlatform(
  platform: SocialPlatform,
  target: PublishTarget | undefined,
  input: Omit<PublishInput, "accountId" | "accessToken">,
  userId: string,
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>
): Promise<PublishTargetResult> {
  const meta = findSocialPlatform(platform);

  if (!target) {
    return rejected(platform, `${meta.title} не подключён`);
  }

  if (!acceptsMediaType(platform, input.mediaType)) {
    const kind = input.mediaType === "video" ? "видео" : "фото";
    return rejected(platform, `${meta.title} не принимает ${kind}`);
  }

  if (input.caption.length > meta.captionLimit) {
    return rejected(platform, `Подпись длиннее ${meta.captionLimit} символов`);
  }

  if (!target.accountId || !target.accessToken) {
    return rejected(platform, `Переподключите ${meta.title}: нет токена доступа`);
  }

  const scheduledAt = input.scheduledAt;

  if ((platform === "instagram" || platform === "tiktok") && scheduledAt) {
    return rejected(
      platform,
      `${meta.title} API не умеет отложенную публикацию — выберите Publish Now`
    );
  }

  if (platform === "facebook" && scheduledAt) {
    const delay = scheduledAt.getTime() - Date.now();

    if (delay < FACEBOOK_SCHEDULE_MIN_MS) {
      return rejected(platform, "Facebook публикует отложенно не раньше чем через 10 минут");
    }

    if (delay > FACEBOOK_SCHEDULE_MAX_MS) {
      return rejected(platform, "Facebook принимает дату не дальше чем на 30 дней вперёд");
    }
  }

  if (platform === "tiktok") {
    try {
      let accessToken = target.accessToken;

      // Access-токен TikTok живёт около суток — перед постом всегда пробуем refresh.
      if (target.refreshToken) {
        try {
          const refreshed = await refreshTikTokToken(target.refreshToken);
          accessToken = refreshed.accessToken;
          await updateTikTokTokens(admin, userId, {
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken ?? target.refreshToken,
          });
        } catch (refreshError) {
          console.error("[social/publish] tiktok refresh", refreshError);
        }
      }

      const result = await publishToTikTok({
        accessToken,
        mediaUrl: input.mediaUrl,
        mediaType: input.mediaType,
        caption: input.caption,
      });

      return {
        platform,
        status: "published",
        permalink: result.permalink,
        error: null,
      };
    } catch (error) {
      console.error("[social/publish] tiktok", error);

      return rejected(
        platform,
        error instanceof Error ? error.message : "TikTok: неизвестная ошибка"
      );
    }
  }

  const publish = platform === "instagram" ? publishToInstagram : publishToFacebookPage;

  try {
    const result = await publish({
      ...input,
      accountId: target.accountId,
      accessToken: target.accessToken,
    });

    return {
      platform,
      status: scheduledAt ? "scheduled" : "published",
      permalink: result.permalink,
      error: null,
    };
  } catch (error) {
    console.error(`[social/publish] ${platform}`, error);

    return rejected(
      platform,
      error instanceof Error ? error.message : `${meta.title}: неизвестная ошибка`
    );
  }
}

/**
 * Публикует генерацию в выбранные платформы. Личность подтверждаем токеном
 * пользователя, а токены платформ читаем service-role-клиентом — они лежат в
 * таблице, закрытой от самого пользователя.
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

  let scheduledAt: Date | null = null;
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

    scheduledAt = parsed;
  }

  const admin = getSupabaseAdmin();

  if (!admin) {
    return NextResponse.json(
      { error: "На сервере нет SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }

  let targets: Map<SocialPlatform, PublishTarget>;
  try {
    targets = await getPublishTargets(admin, auth.userId);
  } catch (error) {
    console.error("[social/publish]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка Supabase" },
      { status: 500 }
    );
  }

  // Платформы независимы, поэтому ошибка одной не должна отменять остальные.
  const results = await Promise.all(
    platforms.map((platform) =>
      publishToPlatform(
        platform,
        targets.get(platform),
        {
          mediaUrl,
          mediaType,
          caption,
          scheduledAt,
        },
        auth.userId,
        admin
      )
    )
  );

  return NextResponse.json({
    success: results.some((result) => result.status !== "failed"),
    results,
  });
}
