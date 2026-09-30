import { NextResponse, type NextRequest } from "next/server";
import { createOAuthState } from "@/lib/oauthState";
import {
  buildShopifyAuthorizeUrl,
  isShopifyConfigured,
  normalizeShopDomain,
  shopifyRedirectUri,
} from "@/lib/ecommerce/shopify";
import { getRequestAuth } from "@/lib/supabaseRequest";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await getRequestAuth(request);

  if (!auth) {
    return NextResponse.json(
      { error: "Войдите в аккаунт, чтобы подключить Shopify" },
      { status: 401 }
    );
  }

  if (!isShopifyConfigured) {
    return NextResponse.json(
      { error: "Shopify не настроен: нужны SHOPIFY_CLIENT_ID и SHOPIFY_CLIENT_SECRET" },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { shop?: unknown };
  const shop = typeof body.shop === "string" ? normalizeShopDomain(body.shop) : null;

  if (!shop) {
    return NextResponse.json(
      { error: "Укажите домен вида your-store.myshopify.com" },
      { status: 400 }
    );
  }

  const redirectUri = shopifyRedirectUri(request.url);
  const state = createOAuthState(auth.userId);

  return NextResponse.json({
    url: buildShopifyAuthorizeUrl(shop, redirectUri, state),
    redirectUri,
    shop,
  });
}
