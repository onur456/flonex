import { NextResponse, type NextRequest } from "next/server";
import {
  getShopifyCredentials,
  isShopifyConfigured,
  normalizeShopDomain,
  publishToShopify,
} from "@/lib/ecommerce/shopify";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getRequestAuth } from "@/lib/supabaseRequest";

export const runtime = "nodejs";
export const maxDuration = 60;

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const auth = await getRequestAuth(request);

  if (!auth) {
    return NextResponse.json(
      { error: "Войдите в аккаунт, чтобы публиковать в Shopify" },
      { status: 401 }
    );
  }

  if (!isShopifyConfigured) {
    return NextResponse.json(
      { error: "Shopify не настроен: нужны SHOPIFY_CLIENT_ID и SHOPIFY_CLIENT_SECRET" },
      { status: 500 }
    );
  }

  const body = asRecord(await request.json().catch(() => ({})));
  const shopDomain = normalizeShopDomain(asString(body.shopDomain) || asString(body.shop));
  const title = asString(body.title);
  const description = asString(body.description);
  const price = asString(body.price);
  const model3dUrl = asString(body.model3dUrl) || null;
  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((item): item is string => typeof item === "string" && item.startsWith("http"))
    : [];

  if (!shopDomain) {
    return NextResponse.json({ error: "Укажите подключённый shop domain" }, { status: 400 });
  }

  if (!title) {
    return NextResponse.json({ error: "Нужен product title" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "На сервере нет SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }

  try {
    const credentials = await getShopifyCredentials(admin, auth.userId, shopDomain);
    if (!credentials) {
      return NextResponse.json(
        { error: "Этот магазин не подключён. Нажмите Connect Shopify." },
        { status: 404 }
      );
    }

    const product = await publishToShopify({
      shopDomain: credentials.shopDomain,
      accessToken: credentials.accessToken,
      title,
      description,
      price,
      imageUrls,
      model3dUrl,
    });

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error("[ecommerce/shopify/publish]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось создать товар в Shopify" },
      { status: 500 }
    );
  }
}
