"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  CircleDashed,
  Loader2,
  LogIn,
  RefreshCw,
  ShoppingBag,
  Store,
  Unlink,
} from "lucide-react";
import { GlassTabButton, GLASS_TAB_GROUP } from "@/components/ui/GlassTabButton";
import type { SocialNotice } from "@/components/social/SocialAccounts";
import { fetchScheduledPosts, type ScheduledPost } from "@/lib/scheduledPosts";
import {
  disconnectShopifyStore,
  fetchShopifyProducts,
  fetchShopifyStores,
  shopifyStoreLabel,
  startShopifyOAuth,
  type ShopifyCatalogProduct,
  type ShopifyStoreRow,
} from "@/lib/shopifyClient";

type CatalogFilter = "all" | "shopify" | "flonex";

interface CatalogItem {
  id: string;
  title: string;
  imageUrl: string | null;
  price: string | null;
  source: "shopify" | "flonex";
  status: string;
  has3d: boolean;
  subtitle: string;
}

interface ProductsStoresViewProps {
  isSignedIn: boolean;
  userId: string | null;
  notice?: SocialNotice | null;
}

export function ProductsStoresView({
  isSignedIn,
  userId,
  notice = null,
}: ProductsStoresViewProps) {
  const [stores, setStores] = useState<ShopifyStoreRow[]>([]);
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyCatalogProduct[]>([]);
  const [flonexPosts, setFlonexPosts] = useState<ScheduledPost[]>([]);
  const [shopInput, setShopInput] = useState("");
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectedStore = stores[0] ?? null;

  const load = useCallback(async () => {
    if (!isSignedIn) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [{ stores: loadedStores }, posts] = await Promise.all([
        fetchShopifyStores(),
        fetchScheduledPosts(userId),
      ]);

      setStores(loadedStores);
      setFlonexPosts(posts.filter((post) => post.platform === "shopify"));
      setError(null);

      if (loadedStores[0]) {
        try {
          const catalog = await fetchShopifyProducts(loadedStores[0].shopDomain);
          setShopifyProducts(catalog.products);
        } catch (catalogError) {
          setShopifyProducts([]);
          setError(
            catalogError instanceof Error
              ? catalogError.message
              : "Не удалось загрузить товары Shopify"
          );
        }
      } else {
        setShopifyProducts([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить магазины");
      setStores([]);
      setShopifyProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const started = await startShopifyOAuth(shopInput);
      window.location.assign(started.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось начать подключение Shopify");
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connectedStore) return;
    setIsDisconnecting(true);
    setError(null);
    try {
      await disconnectShopifyStore(connectedStore.shopDomain);
      setStores([]);
      setShopifyProducts([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отключить магазин");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const catalog = useMemo<CatalogItem[]>(() => {
    const shopifyItems: CatalogItem[] = shopifyProducts.map((product) => ({
      id: `shopify:${product.id}`,
      title: product.title,
      imageUrl: product.imageUrl,
      price: product.price
        ? `${product.price}${product.currency ? ` ${product.currency}` : ""}`
        : null,
      source: "shopify",
      status: product.status === "ACTIVE" ? "Active" : product.status,
      has3d: product.has3d,
      subtitle: shopifyStoreLabel(product.shopDomain),
    }));

    const flonexItems: CatalogItem[] = flonexPosts.map((post) => ({
      id: `flonex:${post.id}`,
      title: post.productTitle || post.caption || "Untitled product",
      imageUrl: post.mediaUrl,
      price: post.productPrice,
      source: "flonex",
      status: post.status === "published" ? "Published" : post.status,
      has3d: Boolean(post.model3dUrl),
      subtitle: post.accountLabel || "Created in FLONEX",
    }));

    const items = [...shopifyItems, ...flonexItems];
    if (filter === "all") return items;
    return items.filter((item) => item.source === filter);
  }, [filter, flonexPosts, shopifyProducts]);

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Store className="w-4 h-4 text-violet-400" /> Connected Integrations / Stores
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Подключите Shopify, чтобы публиковать товары из календаря и студии.
          </p>
        </div>
        {isSignedIn && (
          <button
            type="button"
            onClick={() => void load()}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl border border-violet-900/30 bg-slate-950/40 hover:bg-white/[0.05] text-xs font-medium text-slate-300 transition inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        )}
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs ${
            notice.kind === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/30 bg-rose-500/10 text-rose-200"
          }`}
        >
          {notice.text}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
          <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
          <p className="text-xs text-rose-200">{error}</p>
        </div>
      )}

      {!isSignedIn ? (
        <div className="rounded-2xl border border-dashed border-violet-900/40 bg-slate-950/40 p-10 flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-slate-800/80 border border-violet-900/30 flex items-center justify-center text-slate-500">
            <LogIn className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-300">Войдите, чтобы подключить магазин</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Shopify-токен хранится в профиле — без аккаунта подключение недоступно.
            </p>
          </div>
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition"
          >
            Sign In
          </Link>
        </div>
      ) : isLoading && !connectedStore ? (
        <div className="rounded-2xl border border-dashed border-violet-900/40 bg-slate-950/40 p-10 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
          <p className="text-xs text-slate-400">Loading stores...</p>
        </div>
      ) : (
        <section className="rounded-2xl border border-violet-900/30 bg-[#0b0f19]/60 backdrop-blur-md p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-lime-400 flex items-center justify-center text-white shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-white">Shopify</h3>
                {connectedStore ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-600/40 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    <CircleDashed className="w-3 h-3" />
                    Not connected
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Товары, цена и 3D-модели уходят в Admin GraphQL вашего магазина.
              </p>
            </div>
          </div>

          {connectedStore ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-violet-900/30 bg-slate-950/50 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {shopifyStoreLabel(connectedStore.shopDomain)}
                </p>
                <p className="text-[11px] text-slate-400 truncate">{connectedStore.shopDomain}</p>
              </div>
              <span className="inline-flex items-center self-start rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                Active
              </span>
              <button
                type="button"
                onClick={() => void handleDisconnect()}
                disabled={isDisconnecting}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-rose-500/20 hover:border-rose-500/40 px-3 py-2 text-xs font-semibold text-slate-200 hover:text-rose-200 disabled:opacity-50"
              >
                {isDisconnecting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Unlink className="w-3.5 h-3.5" />
                )}
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={shopInput}
                onChange={(event) => setShopInput(event.target.value)}
                placeholder="your-store.myshopify.com"
                className="w-full rounded-xl border border-violet-900/30 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
              />
              <button
                type="button"
                onClick={() => void handleConnect()}
                disabled={isConnecting || !shopInput.trim()}
                className="shrink-0 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-violet-600 via-indigo-500 to-fuchsia-500 shadow-[0_0_25px_rgba(124,58,237,0.3)] disabled:opacity-50"
              >
                {isConnecting ? "Connecting..." : "Connect Store"}
              </button>
            </div>
          )}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Products</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Каталог Shopify и товары, созданные в FLONEX
            </p>
          </div>
          <div className={`${GLASS_TAB_GROUP} inline-flex p-1`}>
            <GlassTabButton
              active={filter === "all"}
              layoutId="storesCatalogFilter"
              onClick={() => setFilter("all")}
            >
              All
            </GlassTabButton>
            <GlassTabButton
              active={filter === "shopify"}
              layoutId="storesCatalogFilter"
              onClick={() => setFilter("shopify")}
            >
              Shopify
            </GlassTabButton>
            <GlassTabButton
              active={filter === "flonex"}
              layoutId="storesCatalogFilter"
              onClick={() => setFilter("flonex")}
            >
              FLONEX
            </GlassTabButton>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
            Loading products...
          </div>
        ) : catalog.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-violet-900/40 bg-slate-950/40 p-10 text-center">
            <ShoppingBag className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No products yet</p>
            <p className="text-xs text-slate-500 mt-1">
              {connectedStore
                ? "В магазине пока пусто — опубликуйте товар из календаря."
                : "Подключите Shopify или опубликуйте товар из Calendar."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {catalog.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-violet-900/30 bg-slate-950/50 overflow-hidden"
              >
                <div className="relative h-36 bg-slate-900">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-slate-600">
                      <ShoppingBag className="w-7 h-7" />
                    </div>
                  )}
                  <span className="absolute top-2 left-2 rounded-full border border-violet-500/30 bg-slate-950/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-200">
                    {item.source === "shopify" ? "Shopify" : "FLONEX"}
                  </span>
                  {item.has3d && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-slate-950/80 px-2 py-0.5 text-[9px] font-semibold text-emerald-200">
                      <Box className="w-3 h-3" /> 3D
                    </span>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-sm font-medium text-white truncate">{item.title}</p>
                  <p className="text-[11px] text-slate-500 truncate">{item.subtitle}</p>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-slate-300">
                      {item.price ? item.price : "—"}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                      {item.status}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
