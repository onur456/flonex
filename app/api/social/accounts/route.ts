import { NextResponse, type NextRequest } from "next/server";
import { isSocialPlatform } from "@/lib/social";
import {
  connectSocialAccount,
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
 * Подключение аккаунта без OAuth. Осталось только для TikTok — заглушка до
 * подключения TikTok Login Kit. Instagram и Facebook идут через настоящий Meta
 * OAuth (`/api/social/oauth/meta/start`), иначе в базе не будет токена.
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

  try {
    return NextResponse.json({
      account: await connectSocialAccount(auth.client, auth.userId, platform),
    });
  } catch (error) {
    return failed(error);
  }
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
