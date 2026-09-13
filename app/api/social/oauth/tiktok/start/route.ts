import { NextResponse, type NextRequest } from "next/server";
import { createOAuthState } from "@/lib/oauthState";
import { getRequestAuth } from "@/lib/supabaseRequest";
import {
  buildTikTokAuthorizeUrl,
  isTikTokConfigured,
  tiktokRedirectUri,
} from "@/lib/tiktok";

export const runtime = "nodejs";

/**
 * Ссылка на Login Kit. Id пользователя едет в подписанном `state`: callback
 * приходит обычным редиректом без заголовка Authorization.
 */
export async function POST(request: NextRequest) {
  const auth = await getRequestAuth(request);

  if (!auth) {
    return NextResponse.json(
      { error: "Войдите в аккаунт, чтобы подключить соцсети" },
      { status: 401 }
    );
  }

  if (!isTikTokConfigured) {
    return NextResponse.json(
      { error: "TikTok не настроен: нужны TIKTOK_CLIENT_KEY и TIKTOK_CLIENT_SECRET" },
      { status: 500 }
    );
  }

  const redirectUri = tiktokRedirectUri(request.url);

  return NextResponse.json({
    url: buildTikTokAuthorizeUrl(redirectUri, createOAuthState(auth.userId)),
    redirectUri,
  });
}
