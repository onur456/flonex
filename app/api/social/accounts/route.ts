import { NextResponse, type NextRequest } from "next/server";
import { isSocialPlatform } from "@/lib/social";
import {
  disconnectSocialAccount,
  listSocialAccounts,
  setAutoPublish,
} from "@/lib/socialStore";

export const runtime = "nodejs";

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function GET() {
  return NextResponse.json({ accounts: listSocialAccounts() });
}

/** Переключение режима авто-публикации у подключённого аккаунта. */
export async function PATCH(request: NextRequest) {
  const body = asRecord(await request.json().catch(() => ({})));
  const platform = body.platform;
  const autoPublish = body.autoPublish;

  if (!isSocialPlatform(platform)) {
    return NextResponse.json(
      { error: "Неизвестная платформа" },
      { status: 400 }
    );
  }

  if (typeof autoPublish !== "boolean") {
    return NextResponse.json(
      { error: "autoPublish должен быть boolean" },
      { status: 400 }
    );
  }

  const account = setAutoPublish(platform, autoPublish);

  if (!account) {
    return NextResponse.json(
      { error: "Сначала подключите аккаунт" },
      { status: 409 }
    );
  }

  return NextResponse.json({ account });
}

export async function DELETE(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get("platform");

  if (!isSocialPlatform(platform)) {
    return NextResponse.json(
      { error: "Неизвестная платформа" },
      { status: 400 }
    );
  }

  return NextResponse.json({ account: disconnectSocialAccount(platform) });
}
