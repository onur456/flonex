import { NextResponse, type NextRequest } from "next/server";
import {
  appOrigin,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  isMetaConfigured,
  listManagedPages,
  metaRedirectUri,
} from "@/lib/meta";
import { verifyOAuthState } from "@/lib/oauthState";
import { saveMetaConnection } from "@/lib/socialStore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Возврат в приложение. Раздел Social Auto-Publish читает эти параметры и
 * показывает результат подключения.
 */
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
 * Callback Meta OAuth. Пользователя определяем по подписанному `state`, а не по
 * сессии: браузер приходит сюда редиректом без заголовка `Authorization`.
 * Поэтому пишем от service_role — токены страниц пользователю недоступны.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  // Пользователь нажал «Отмена» или Meta отклонила запрос.
  const oauthError = params.get("error_description") || params.get("error");
  if (oauthError) {
    return failure(request, oauthError);
  }

  if (!isMetaConfigured) {
    return failure(request, "Meta не настроена: нужны META_CLIENT_ID и META_CLIENT_SECRET");
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
    return failure(request, "Meta не вернула код авторизации");
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return failure(request, "На сервере нет SUPABASE_SERVICE_ROLE_KEY");
  }

  try {
    const shortLived = await exchangeCodeForToken(code, metaRedirectUri(request.url));
    const userToken = await exchangeForLongLivedToken(shortLived);
    const pages = await listManagedPages(userToken);

    if (pages.length === 0) {
      return failure(
        request,
        "У аккаунта нет страниц Facebook. Создайте страницу и повторите подключение"
      );
    }

    // Схема хранит одно подключение на платформу, поэтому берём первую страницу.
    const page = pages[0];
    const platforms = await saveMetaConnection(admin, userId, page);

    return backToApp(request, {
      social: "connected",
      accounts: platforms.join(","),
      page: page.name,
      ...(page.instagram
        ? {}
        : {
            message:
              "Instagram не подключён: к странице не привязан профессиональный аккаунт Instagram",
          }),
    });
  } catch (error) {
    console.error("[social/oauth/meta/callback]", error);

    return failure(
      request,
      error instanceof Error ? error.message : "Не удалось подключить Meta"
    );
  }
}
