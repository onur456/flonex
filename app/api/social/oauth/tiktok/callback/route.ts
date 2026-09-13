import { NextResponse, type NextRequest } from "next/server";
import { appOrigin } from "@/lib/meta";
import { verifyOAuthState } from "@/lib/oauthState";
import { saveTikTokConnection } from "@/lib/socialStore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  exchangeTikTokCode,
  fetchTikTokProfile,
  isTikTokConfigured,
  tiktokRedirectUri,
} from "@/lib/tiktok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backToApp(
  request: NextRequest,
  params: Record<string, string>
): NextResponse {
  const target = new URL("/", appOrigin(request.url));
  target.searchParams.set("view", "social");

  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value);
  }

  return NextResponse.redirect(target);
}

function failure(request: NextRequest, message: string): NextResponse {
  return backToApp(request, { social: "error", message });
}

/**
 * Callback Login Kit. Пользователя узнаём по `state`, пишем от service_role:
 * токены TikTok в таблице, закрытой от anon и authenticated.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const oauthError = params.get("error_description") || params.get("error");
  if (oauthError) {
    return failure(request, oauthError);
  }

  if (!isTikTokConfigured) {
    return failure(
      request,
      "TikTok не настроен: нужны TIKTOK_CLIENT_KEY и TIKTOK_CLIENT_SECRET"
    );
  }

  const userId = verifyOAuthState(params.get("state"));
  if (!userId) {
    return failure(
      request,
      "Ссылка подключения истекла или повреждена — нажмите Connect ещё раз"
    );
  }

  const code = params.get("code");
  if (!code) {
    return failure(request, "TikTok не вернула код авторизации");
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return failure(request, "На сервере нет SUPABASE_SERVICE_ROLE_KEY");
  }

  try {
    const tokens = await exchangeTikTokCode(code, tiktokRedirectUri(request.url));
    const profile = await fetchTikTokProfile(tokens.accessToken);

    await saveTikTokConnection(admin, userId, {
      openId: tokens.openId || profile.openId,
      username: profile.username,
      avatarUrl: profile.avatarUrl,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });

    return backToApp(request, {
      social: "connected",
      accounts: "tiktok",
      ...(profile.username ? { page: profile.username } : {}),
    });
  } catch (error) {
    console.error("[social/oauth/tiktok/callback]", error);

    return failure(
      request,
      error instanceof Error ? error.message : "Не удалось подключить TikTok"
    );
  }
}
