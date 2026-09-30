import { NextResponse, type NextRequest } from "next/server";
import {
  deleteShopifyStore,
  listShopifyStores,
  normalizeShopDomain,
} from "@/lib/ecommerce/shopify";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getRequestAuth } from "@/lib/supabaseRequest";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuth(request);

  if (!auth) {
    return NextResponse.json(
      { error: "Войдите в аккаунт, чтобы увидеть магазины Shopify" },
      { status: 401 }
    );
  }

  try {
    const stores = await listShopifyStores(auth.client, auth.userId);
    return NextResponse.json({ stores });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось загрузить магазины" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await getRequestAuth(request);

  if (!auth) {
    return NextResponse.json(
      { error: "Войдите в аккаунт, чтобы отключить Shopify" },
      { status: 401 }
    );
  }

  const shop = normalizeShopDomain(request.nextUrl.searchParams.get("shop") || "");
  if (!shop) {
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
    await deleteShopifyStore(admin, auth.userId, shop);
    return NextResponse.json({ success: true, shop });
  } catch (error) {
    console.error("[ecommerce/shopify/stores]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось отключить магазин" },
      { status: 500 }
    );
  }
}
