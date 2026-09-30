import { createHmac, timingSafeEqual } from "node:crypto";
import { appOrigin } from "@/lib/meta";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptShopifyToken, encryptShopifyToken } from "./shopifyCrypto";

export const SHOPIFY_API_VERSION = "2024-01";
export const SHOPIFY_CALLBACK_PATH = "/api/ecommerce/shopify/callback";
export const SHOPIFY_SCOPES = ["write_products", "read_products", "write_files"].join(",");

export const shopifyClientId = process.env.SHOPIFY_CLIENT_ID?.trim() || "";
export const shopifyClientSecret = process.env.SHOPIFY_CLIENT_SECRET?.trim() || "";
export const isShopifyConfigured = Boolean(shopifyClientId && shopifyClientSecret);

export function shopifyRedirectUri(requestUrl: string): string {
  return `${appOrigin(requestUrl)}${SHOPIFY_CALLBACK_PATH}`;
}

export function normalizeShopDomain(input: string): string | null {
  const host = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0];

  const shop = host.endsWith(".myshopify.com") ? host : `${host}.myshopify.com`;
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) return null;
  return shop;
}

export function buildShopifyAuthorizeUrl(
  shop: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: shopifyClientId,
    scope: SHOPIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
  });

  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

export function verifyShopifyHmac(searchParams: URLSearchParams): boolean {
  const hmac = searchParams.get("hmac");
  if (!hmac || !shopifyClientSecret) return false;

  const pairs: string[] = [];
  searchParams.forEach((value, key) => {
    if (key !== "hmac" && key !== "signature") {
      pairs.push(`${key}=${value}`);
    }
  });
  pairs.sort();

  const digest = createHmac("sha256", shopifyClientSecret)
    .update(pairs.join("&"))
    .digest("hex");

  try {
    const received = Buffer.from(hmac, "hex");
    const expected = Buffer.from(digest, "hex");
    return received.length === expected.length && timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}

export async function exchangeShopifyCode(
  shop: string,
  code: string
): Promise<string> {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: shopifyClientId,
      client_secret: shopifyClientSecret,
      code,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description || payload.error || `Shopify token exchange failed (${response.status})`
    );
  }

  return payload.access_token;
}

export interface ShopifyStoreRow {
  id: string;
  shopDomain: string;
  createdAt: string;
}

export async function saveShopifyStore(
  admin: SupabaseClient,
  userId: string,
  shopDomain: string,
  accessToken: string
): Promise<void> {
  const encrypted = encryptShopifyToken(accessToken);

  const { error } = await admin.from("shopify_stores").upsert(
    {
      user_id: userId,
      shop_domain: shopDomain,
      access_token: encrypted,
    },
    { onConflict: "user_id,shop_domain" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function listShopifyStores(
  client: SupabaseClient,
  userId: string
): Promise<ShopifyStoreRow[]> {
  const { data, error } = await client
    .from("shopify_stores")
    .select("id, shop_domain, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    shopDomain: String(row.shop_domain),
    createdAt: String(row.created_at),
  }));
}

export async function getShopifyCredentials(
  admin: SupabaseClient,
  userId: string,
  shopDomain?: string | null
): Promise<{ shopDomain: string; accessToken: string } | null> {
  let query = admin
    .from("shopify_stores")
    .select("shop_domain, access_token")
    .eq("user_id", userId);

  if (shopDomain) {
    query = query.eq("shop_domain", shopDomain);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.access_token || !data.shop_domain) return null;

  return {
    shopDomain: String(data.shop_domain),
    accessToken: decryptShopifyToken(String(data.access_token)),
  };
}

export async function deleteShopifyStore(
  admin: SupabaseClient,
  userId: string,
  shopDomain: string
): Promise<void> {
  const { error } = await admin
    .from("shopify_stores")
    .delete()
    .eq("user_id", userId)
    .eq("shop_domain", shopDomain);

  if (error) {
    throw new Error(error.message);
  }
}

export interface ShopifyCatalogProduct {
  id: string;
  title: string;
  status: string;
  handle: string;
  description: string;
  imageUrl: string | null;
  price: string | null;
  currency: string | null;
  has3d: boolean;
  shopDomain: string;
}

interface GraphqlError {
  message?: string;
}

interface UserError {
  field?: string[] | null;
  message?: string;
}

async function shopifyGraphql<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    }
  );

  const payload = (await response.json().catch(() => ({}))) as {
    data?: T;
    errors?: GraphqlError[];
  };

  if (!response.ok) {
    throw new Error(`Shopify GraphQL HTTP ${response.status}`);
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((item) => item.message).filter(Boolean).join("; "));
  }

  if (!payload.data) {
    throw new Error("Shopify GraphQL returned no data");
  }

  return payload.data;
}

function firstUserError(errors: UserError[] | undefined): string | null {
  const message = errors?.find((item) => item.message)?.message;
  return message || null;
}

export interface PublishToShopifyInput {
  shopDomain: string;
  accessToken: string;
  title: string;
  description: string;
  price: string;
  imageUrls: string[];
  model3dUrl?: string | null;
}

export interface PublishToShopifyResult {
  productId: string;
  title: string;
}

const PRODUCTS_QUERY = `
  query Catalog($first: Int!) {
    products(first: $first, sortKey: UPDATED_AT, reverse: true) {
      edges {
        node {
          id
          title
          status
          handle
          description
          featuredImage { url altText }
          priceRangeV2 {
            minVariantPrice { amount currencyCode }
          }
          media(first: 8) {
            edges {
              node { mediaContentType }
            }
          }
        }
      }
    }
  }
`;

export async function listShopifyProducts(
  shopDomain: string,
  accessToken: string,
  first = 24
): Promise<ShopifyCatalogProduct[]> {
  const data = await shopifyGraphql<{
    products: {
      edges: Array<{
        node: {
          id: string;
          title: string;
          status?: string | null;
          handle?: string | null;
          description?: string | null;
          featuredImage?: { url?: string | null } | null;
          priceRangeV2?: {
            minVariantPrice?: { amount?: string | null; currencyCode?: string | null } | null;
          } | null;
          media?: {
            edges?: Array<{ node?: { mediaContentType?: string | null } | null }>;
          } | null;
        };
      }>;
    };
  }>(shopDomain, accessToken, PRODUCTS_QUERY, { first });

  return data.products.edges.map(({ node }) => ({
    id: node.id,
    title: node.title,
    status: node.status || "ACTIVE",
    handle: node.handle || "",
    description: node.description || "",
    imageUrl: node.featuredImage?.url || null,
    price: node.priceRangeV2?.minVariantPrice?.amount || null,
    currency: node.priceRangeV2?.minVariantPrice?.currencyCode || null,
    has3d: Boolean(
      node.media?.edges?.some((edge) => edge.node?.mediaContentType === "MODEL_3D")
    ),
    shopDomain,
  }));
}

const PRODUCT_CREATE = `
  mutation ProductCreate($input: ProductInput!) {
    productCreate(input: $input) {
      product { id title }
      userErrors { field message }
    }
  }
`;

const STAGED_UPLOADS = `
  mutation StagedUploads($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }
`;

const PRODUCT_CREATE_MEDIA = `
  mutation ProductCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
    productCreateMedia(productId: $productId, media: $media) {
      media { ... on Model3d { id } }
      mediaUserErrors { field message }
      userErrors { field message }
    }
  }
`;

async function attachModel3d(
  shopDomain: string,
  accessToken: string,
  productId: string,
  model3dUrl: string
): Promise<void> {
  const fileResponse = await fetch(model3dUrl);
  if (!fileResponse.ok) {
    throw new Error(`Не удалось скачать GLB (${fileResponse.status})`);
  }

  const buffer = Buffer.from(await fileResponse.arrayBuffer());
  const filename = `flonex-${Date.now()}.glb`;

  const staged = await shopifyGraphql<{
    stagedUploadsCreate: {
      stagedTargets: Array<{
        url: string | null;
        resourceUrl: string | null;
        parameters: Array<{ name: string; value: string }>;
      }>;
      userErrors: UserError[];
    };
  }>(shopDomain, accessToken, STAGED_UPLOADS, {
    input: [
      {
        resource: "MODEL_3D",
        filename,
        mimeType: "model/gltf-binary",
        httpMethod: "POST",
        fileSize: String(buffer.byteLength),
      },
    ],
  });

  const stagedError = firstUserError(staged.stagedUploadsCreate.userErrors);
  if (stagedError) throw new Error(stagedError);

  const target = staged.stagedUploadsCreate.stagedTargets[0];
  if (!target?.url || !target.resourceUrl) {
    throw new Error("Shopify не вернул staged upload для GLB");
  }

  const form = new FormData();
  for (const parameter of target.parameters) {
    form.append(parameter.name, parameter.value);
  }
  form.append("file", new Blob([new Uint8Array(buffer)], { type: "model/gltf-binary" }), filename);

  const upload = await fetch(target.url, { method: "POST", body: form });
  if (!upload.ok) {
    throw new Error(`Shopify staged upload failed (${upload.status})`);
  }

  const media = await shopifyGraphql<{
    productCreateMedia: {
      mediaUserErrors?: UserError[];
      userErrors?: UserError[];
    };
  }>(shopDomain, accessToken, PRODUCT_CREATE_MEDIA, {
    productId,
    media: [
      {
        originalSource: target.resourceUrl,
        mediaContentType: "MODEL_3D",
      },
    ],
  });

  const mediaError =
    firstUserError(media.productCreateMedia.mediaUserErrors) ||
    firstUserError(media.productCreateMedia.userErrors);
  if (mediaError) throw new Error(mediaError);
}

export async function publishToShopify(
  input: PublishToShopifyInput
): Promise<PublishToShopifyResult> {
  const title = input.title.trim();
  const price = input.price.trim() || "0.00";
  const imageUrls = input.imageUrls.filter((url) => /^https?:\/\//i.test(url));

  const created = await shopifyGraphql<{
    productCreate: {
      product: { id: string; title: string } | null;
      userErrors: UserError[];
    };
  }>(input.shopDomain, input.accessToken, PRODUCT_CREATE, {
    input: {
      title,
      descriptionHtml: input.description.trim()
        ? `<p>${input.description.trim().replace(/</g, "&lt;")}</p>`
        : undefined,
      status: "ACTIVE",
      variants: [{ price }],
      images: imageUrls.slice(0, 8).map((src) => ({ src })),
    },
  });

  const createError = firstUserError(created.productCreate.userErrors);
  if (createError) throw new Error(createError);

  const product = created.productCreate.product;
  if (!product?.id) {
    throw new Error("Shopify не вернул id товара");
  }

  if (input.model3dUrl) {
    await attachModel3d(
      input.shopDomain,
      input.accessToken,
      product.id,
      input.model3dUrl
    );
  }

  return { productId: product.id, title: product.title };
}
