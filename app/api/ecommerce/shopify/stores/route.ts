import { NextResponse, type NextRequest } from "next/server";
import { listShopifyStores } from "@/lib/ecommerce/shopify";
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
