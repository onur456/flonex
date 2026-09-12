import { NextResponse, type NextRequest } from "next/server";
import { isSocialPlatform } from "@/lib/social";
import { connectSocialAccount } from "@/lib/socialStore";

export const runtime = "nodejs";

/**
 * Разрешаем только относительные пути внутри приложения, иначе `returnTo`
 * превращается в open redirect.
 */
function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

/**
 * Заглушка OAuth-подключения аккаунта. Реальный обработчик должен редиректить на
 * authorize-страницу платформы (Meta Login / TikTok Login Kit) и обменивать `code`
 * на долгоживущий токен в отдельном callback-роуте. Пока сразу помечаем аккаунт
 * подключённым и возвращаем пользователя в интерфейс.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const target = new URL(returnTo, request.nextUrl.origin);

  if (!isSocialPlatform(provider)) {
    target.searchParams.set("social", "error");
    target.searchParams.set("provider", provider);
    return NextResponse.redirect(target);
  }

  connectSocialAccount(provider);

  target.searchParams.set("social", "connected");
  target.searchParams.set("provider", provider);
  return NextResponse.redirect(target);
}
