import { NextResponse, type NextRequest } from "next/server";
import {
  exchangeShopifyCode,
  isShopifyConfigured,
  normalizeShopDomain,
  saveShopifyStore,
  verifyShopifyHmac,
} from "@/lib/ecommerce/shopify";
import { appOrigin } from "@/lib/meta";
import { verifyOAuthState } from "@/lib/oauthState";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backToApp(request: NextRequest, params: Record<string, string>): NextResponse {
  const target = new URL("/", appOrigin(request.url));
  target.searchParams.set("view", "stores");

  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value);
  }

  return NextResponse.redirect(target);
}

function failure(request: NextRequest, message: string): NextResponse {
  return backToApp(request, { shopify: "error", message });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const oauthError = params.get("error_description") || params.get("error");
  if (oauthError) {
    return failure(request, oauthError);
  }

  if (!isShopifyConfigured) {
    return failure(
      request,
      "Shopify не настроен: нужны SHOPIFY_CLIENT_ID и SHOPIFY_CLIENT_SECRET"
    );
  }

  if (!verifyShopifyHmac(params)) {
    return failure(request, "Shopify HMAC не совпал — запрос отклонён");
  }

  const userId = verifyOAuthState(params.get("state"));
  if (!userId) {
    return failure(
      request,
      "Ссылка подключения истекла или повреждена — нажмите Connect ещё раз"
    );
  }

  const shop = normalizeShopDomain(params.get("shop") || "");
  const code = params.get("code");
  if (!shop || !code) {
    return failure(request, "Shopify не вернул shop или code");
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return failure(request, "На сервере нет SUPABASE_SERVICE_ROLE_KEY");
  }

  try {
    const accessToken = await exchangeShopifyCode(shop, code);
    await saveShopifyStore(admin, userId, shop, accessToken);

    return backToApp(request, {
      shopify: "connected",
      shop,
    });
  } catch (error) {
    console.error("[ecommerce/shopify/callback]", error);
    return failure(
      request,
      error instanceof Error ? error.message : "Не удалось подключить Shopify"
    );
  }
}
