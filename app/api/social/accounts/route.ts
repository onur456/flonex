import { NextResponse, type NextRequest } from "next/server";
import { isSocialPlatform } from "@/lib/social";
import {
  disconnectSocialAccount,
  listSocialAccounts,
  setAutoPublish,
} from "@/lib/socialStore";
import { getRequestAuth } from "@/lib/supabaseRequest";

export const runtime = "nodejs";

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function unauthorized() {
  return NextResponse.json(
    { error: "Войдите в аккаунт, чтобы управлять подключениями" },
    { status: 401 }
  );
}

function failed(error: unknown) {
  console.error("[social/accounts]", error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Ошибка Supabase" },
    { status: 500 }
  );
}

export async function GET(request: NextRequest) {
  const auth = await getRequestAuth(request);
  if (!auth) return unauthorized();

  try {
    return NextResponse.json({
      accounts: await listSocialAccounts(auth.client, auth.userId),
    });
  } catch (error) {
    return failed(error);
  }
}

/**
 * Подключение без OAuth больше не поддерживается: у всех трёх платформ
 * настоящий вход, иначе в `social_account_secrets` не будет токена.
 */
export async function POST(request: NextRequest) {
  const auth = await getRequestAuth(request);
  if (!auth) return unauthorized();

  const body = asRecord(await request.json().catch(() => ({})));
  const platform = body.platform;

  if (!isSocialPlatform(platform)) {
    return NextResponse.json({ error: "Неизвестная платформа" }, { status: 400 });
  }

  if (platform === "instagram" || platform === "facebook") {
    return NextResponse.json(
      { error: "Instagram и Facebook подключаются через вход в Meta" },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { error: "TikTok подключается через вход в Login Kit" },
    { status: 400 }
  );
}

/** Переключение режима авто-публикации у подключённого аккаунта. */
export async function PATCH(request: NextRequest) {
  const auth = await getRequestAuth(request);
  if (!auth) return unauthorized();

  const body = asRecord(await request.json().catch(() => ({})));
  const platform = body.platform;
  const autoPublish = body.autoPublish;

  if (!isSocialPlatform(platform)) {
    return NextResponse.json({ error: "Неизвестная платформа" }, { status: 400 });
  }

  if (typeof autoPublish !== "boolean") {
    return NextResponse.json({ error: "autoPublish должен быть boolean" }, { status: 400 });
  }

  try {
    const account = await setAutoPublish(auth.client, auth.userId, platform, autoPublish);

    if (!account) {
      return NextResponse.json({ error: "Сначала подключите аккаунт" }, { status: 409 });
    }

    return NextResponse.json({ account });
  } catch (error) {
    return failed(error);
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await getRequestAuth(request);
  if (!auth) return unauthorized();

  const platform = request.nextUrl.searchParams.get("platform");

  if (!isSocialPlatform(platform)) {
    return NextResponse.json({ error: "Неизвестная платформа" }, { status: 400 });
  }

  try {
    await disconnectSocialAccount(auth.client, auth.userId, platform);
    return NextResponse.json({ platform });
  } catch (error) {
    return failed(error);
  }
}
