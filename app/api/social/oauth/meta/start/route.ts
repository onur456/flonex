import { NextResponse, type NextRequest } from "next/server";
import { buildMetaAuthorizeUrl, isMetaConfigured, metaRedirectUri } from "@/lib/meta";
import { createOAuthState } from "@/lib/oauthState";
import { getRequestAuth } from "@/lib/supabaseRequest";

export const runtime = "nodejs";

/**
 * Выдаёт ссылку на диалог Meta. Отдельный шаг нужен потому, что личность
 * пользователя известна только здесь — по токену в заголовке. Дальше её несёт
 * подписанный `state`, ведь на callback браузер придёт без заголовков.
 *
 * `redirectUri` возвращаем вместе со ссылкой: если адрес не добавлен в Valid
 * OAuth Redirect URIs, Meta покажет ошибку, и знать точное значение полезно.
 */
export async function POST(request: NextRequest) {
  const auth = await getRequestAuth(request);

  if (!auth) {
    return NextResponse.json(
      { error: "Войдите в аккаунт, чтобы подключить соцсети" },
      { status: 401 }
    );
  }

  if (!isMetaConfigured) {
    return NextResponse.json(
      { error: "Meta не настроена: нужны META_CLIENT_ID и META_CLIENT_SECRET" },
      { status: 500 }
    );
  }

  const redirectUri = metaRedirectUri(request.url);

  return NextResponse.json({
    url: buildMetaAuthorizeUrl(redirectUri, createOAuthState(auth.userId)),
    redirectUri,
  });
}
