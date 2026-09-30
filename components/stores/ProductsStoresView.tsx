"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  LogIn,
  Package,
  RefreshCw,
  Send,
  ShoppingBag,
  Store,
} from "lucide-react";
import { SchedulePostModal } from "@/components/calendar/SchedulePostModal";
import type { SocialNotice } from "@/components/social/SocialAccounts";
import { StoreIntegrationCard } from "./StoreIntegrationCard";
import {
  disconnectShopifyStore,
  fetchShopifyStores,
  shopifyStoreLabel,
  startShopifyOAuth,
  type ShopifyStoreRow,
} from "@/lib/shopifyClient";

const STORE_COUNT = 2;

interface ProductsStoresViewProps {
  isSignedIn: boolean;
  userId: string | null;
  productName?: string;
  notice?: SocialNotice | null;
}

export function ProductsStoresView({
  isSignedIn,
  userId,
  productName,
  notice = null,
}: ProductsStoresViewProps) {
  const [stores, setStores] = useState<ShopifyStoreRow[]>([]);
  const [shopInput, setShopInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectedStore = stores[0] ?? null;
  const connectedCount = connectedStore ? 1 : 0;

  const load = useCallback(async () => {
    if (!isSignedIn) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { stores: loadedStores } = await fetchShopifyStores();
      setStores(loadedStores);
      setShopInput(loadedStores[0]?.shopDomain ?? "");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить магазины");
      setStores([]);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn]);

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
      setShopInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отключить магазин");
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Store className="w-4 h-4 text-indigo-400" /> E-Commerce Stores
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Connect your e-commerce platforms to automatically push AI generations
            directly to your store catalogs.
          </p>
        </div>

        {isSignedIn && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={isLoading}
              className="px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 transition inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => setIsScheduleOpen(true)}
              disabled={connectedCount === 0}
              title={
                connectedCount === 0
                  ? "Сначала подключите хотя бы один магазин"
                  : "Опубликовать последнюю генерацию в Shopify"
              }
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
              Publish Latest
            </button>
          </div>
        )}
      </div>

      {!isSignedIn ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-10 flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-500">
            <LogIn className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-300">Войдите, чтобы подключить магазины</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Подключения хранятся в вашем профиле, поэтому для них нужен аккаунт Flonex.
            </p>
          </div>
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition"
          >
            Sign In
          </Link>
        </div>
      ) : (
        <>
          {notice && (
            <div
              className={`flex items-start gap-2.5 rounded-xl border p-3.5 ${
                notice.kind === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-amber-500/30 bg-amber-500/10"
              }`}
            >
              {notice.kind === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              )}
              <p
                className={`text-xs break-words ${
                  notice.kind === "success" ? "text-emerald-200" : "text-amber-200"
                }`}
              >
                {notice.text}
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-rose-300">Ошибка синхронизации магазинов</p>
                <p className="text-[11px] text-rose-200/80 mt-1 break-words">{error}</p>
              </div>
            </div>
          )}

          {isLoading && connectedCount === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-10 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <p className="text-xs text-slate-400">Загружаем подключённые магазины...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              <StoreIntegrationCard
                title="Shopify"
                subtitle="Products, pricing & 3D models via Admin GraphQL API"
                accent="from-emerald-500 to-lime-400"
                icon={ShoppingBag}
                status={connectedStore ? "connected" : "disconnected"}
                connectedLabel={
                  connectedStore ? shopifyStoreLabel(connectedStore.shopDomain) : null
                }
                showShopInput
                shopInput={shopInput}
                onShopInputChange={setShopInput}
                shopInputDisabled={Boolean(connectedStore) || isConnecting || isDisconnecting}
                actionLabel={connectedStore ? "Disconnect" : "Connect Shopify"}
                actionVariant={connectedStore ? "disconnect" : "connect"}
                isPending={isConnecting || isDisconnecting}
                actionDisabled={connectedStore ? false : !shopInput.trim()}
                onAction={connectedStore ? handleDisconnect : handleConnect}
                onPublish={() => setIsScheduleOpen(true)}
                publishDisabled={!connectedStore}
                publishTitle={
                  connectedStore
                    ? "Publish product to Shopify"
                    : "Connect store first to publish"
                }
              />

              <StoreIntegrationCard
                title="Amazon"
                subtitle="Listings, A+ Content & product feeds"
                accent="from-amber-600 via-orange-500 to-yellow-400"
                icon={Package}
                status="coming_soon"
                actionLabel="Connect Amazon"
                actionVariant="disabled"
                publishDisabled
                publishTitle="Connect Amazon first to publish"
              />
            </div>
          )}

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5">
            <p className="text-xs font-semibold text-slate-300">
              {connectedCount} of {STORE_COUNT} stores connected
            </p>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
              Connecting Shopify allows FLONEX to publish generated product cards and 3D
              models directly to your store backend without exporting files manually.
            </p>
          </div>
        </>
      )}

      {isScheduleOpen && (
        <SchedulePostModal
          day={new Date()}
          userId={userId}
          productName={productName}
          initialPlatform="shopify"
          onClose={() => setIsScheduleOpen(false)}
          onCreated={() => setIsScheduleOpen(false)}
        />
      )}
    </div>
  );
}
