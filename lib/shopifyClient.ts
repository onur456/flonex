import { supabase } from "./supabase";
import type { ShopifyCatalogProduct, ShopifyStoreRow } from "./ecommerce/shopify";

export type { ShopifyCatalogProduct, ShopifyStoreRow };

export class ShopifyApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ShopifyApiError";
    this.status = status;
  }
}

export function shopifyStoreLabel(domain: string): string {
  return domain.replace(/\.myshopify\.com$/i, "");
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
  return request(`/api/ecommerce/shopify/connect?shop=${encodeURIComponent(shop)}`);
}

export function disconnectShopifyStore(
  shopDomain: string
): Promise<{ success: boolean; shop: string }> {
  return request(`/api/ecommerce/shopify/stores?shop=${encodeURIComponent(shopDomain)}`, {
    method: "DELETE",
  });
}

export function fetchShopifyProducts(shopDomain?: string): Promise<{
  products: ShopifyCatalogProduct[];
  shopDomain: string | null;
}> {
  const query = shopDomain ? `?shop=${encodeURIComponent(shopDomain)}` : "";
  return request(`/api/ecommerce/shopify/products${query}`);
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
