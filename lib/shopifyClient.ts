import { supabase } from "./supabase";
import type { ShopifyStoreRow } from "./ecommerce/shopify";

export class ShopifyApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ShopifyApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new ShopifyApiError("Войдите в аккаунт, чтобы подключить Shopify", 401);
  }

  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };

  if (!res.ok) {
    throw new ShopifyApiError(data.error || `Status ${res.status}`, res.status);
  }

  return data;
}

export function fetchShopifyStores(): Promise<{ stores: ShopifyStoreRow[] }> {
  return request("/api/ecommerce/shopify/stores");
}

export function startShopifyOAuth(shop: string): Promise<{
  url: string;
  redirectUri: string;
  shop: string;
}> {
  return request("/api/ecommerce/shopify/connect", {
    method: "POST",
    body: JSON.stringify({ shop }),
  });
}

export function publishShopifyProduct(input: {
  shopDomain: string;
  title: string;
  description: string;
  price: string;
  imageUrls: string[];
  model3dUrl?: string | null;
}): Promise<{ success: boolean; product: { productId: string; title: string } }> {
  return request("/api/ecommerce/shopify/publish", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
