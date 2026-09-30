import { NextResponse, type NextRequest } from "next/server";
import {
  getShopifyCredentials,
  listShopifyProducts,
  normalizeShopDomain,
} from "@/lib/ecommerce/shopify";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getRequestAuth } from "@/lib/supabaseRequest";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuth(request);

  if (!auth) {
    return NextResponse.json(
      { error: "Войдите в аккаунт, чтобы увидеть товары Shopify" },
      { status: 401 }
    );
  }

  const shopParam = request.nextUrl.searchParams.get("shop") || "";
  const shopDomain = shopParam ? normalizeShopDomain(shopParam) : null;

  if (shopParam && !shopDomain) {
    return NextResponse.json(
      { error: "Укажите домен вида your-store.myshopify.com" },
      { status: 400 }
    );
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
      return NextResponse.json({ products: [], shopDomain: null });
    }

    const products = await listShopifyProducts(
      credentials.shopDomain,
      credentials.accessToken
    );

    return NextResponse.json({
      products,
      shopDomain: credentials.shopDomain,
    });
  } catch (error) {
    console.error("[ecommerce/shopify/products]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось загрузить товары Shopify" },
      { status: 500 }
    );
  }
}
