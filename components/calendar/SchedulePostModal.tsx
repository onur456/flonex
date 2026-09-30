"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Image as ImageIcon,
  Loader2,
  ShoppingBag,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import {
  fetchGenerationAssets,
  type GenerationAsset,
} from "@/lib/generations";
import {
  combineLocalDateTime,
  dateKey,
  defaultTimeForDay,
} from "@/lib/calendar";
import { insertScheduledPost, type ScheduledPost } from "@/lib/scheduledPosts";
import { plannerPlatformLabel, type PlannerPlatform } from "@/lib/planner";
import { enhanceCaption, fetchAccounts, publishAsset } from "@/lib/socialClient";
import {
  fetchShopifyStores,
  publishShopifyProduct,
  shopifyStoreLabel,
} from "@/lib/shopifyClient";
import { fetchGeneratedModels, type SavedGeneratedModel } from "@/lib/save3dModel";
import type { ShopifyStoreRow } from "@/lib/shopifyClient";
import {
  acceptsMediaType,
  findSocialPlatform,
  type SocialAccount,
  type SocialMediaType,
  type SocialPlatform,
} from "@/lib/social";
import { PlatformTile } from "@/components/social/PlatformIcon";

const SOCIAL_PLANNER_PLATFORMS: SocialPlatform[] = ["facebook", "instagram", "tiktok"];

interface SchedulePostModalProps {
  day: Date;
  userId: string | null;
  productName?: string;
  initialPlatform?: PlannerPlatform | null;
  onClose: () => void;
  onCreated: (post: ScheduledPost) => void;
  onOpenStores?: () => void;
}

function defaultDateTime(day: Date) {
  return {
    date: dateKey(day),
    time: defaultTimeForDay(day),
  };
}

export function SchedulePostModal({
  day,
  userId,
  productName,
  initialPlatform = null,
  onClose,
  onCreated,
}: SchedulePostModalProps) {
  const [assets, setAssets] = useState<GenerationAsset[]>([]);
  const [models, setModels] = useState<SavedGeneratedModel[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [stores, setStores] = useState<ShopifyStoreRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [platform, setPlatform] = useState<PlannerPlatform | null>(initialPlatform);
  const [caption, setCaption] = useState("");
  const [productTitle, setProductTitle] = useState(productName ?? "");
  const [productDescription, setProductDescription] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [model3dUrl, setModel3dUrl] = useState("");
  const [shopDomain, setShopDomain] = useState("");
  const [schedule, setSchedule] = useState(() => defaultDateTime(day));
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSaving, onClose]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [loadedAssets, loadedModels, accountPayload, storePayload] = await Promise.all([
          fetchGenerationAssets(24).catch(() => [] as GenerationAsset[]),
          fetchGeneratedModels(12),
          userId
            ? fetchAccounts().catch(() => ({ accounts: [] as SocialAccount[] }))
            : Promise.resolve({ accounts: [] as SocialAccount[] }),
          userId
            ? fetchShopifyStores().catch(() => ({ stores: [] as ShopifyStoreRow[] }))
            : Promise.resolve({ stores: [] as ShopifyStoreRow[] }),
        ]);

        if (cancelled) return;
        setAssets(loadedAssets);
        setModels(loadedModels);
        setAccounts(accountPayload.accounts);
        setStores(storePayload.stores);
        setSelectedUrl((current) => current ?? loadedAssets[0]?.url ?? null);
        setShopDomain((current) => current || storePayload.stores[0]?.shopDomain || "");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Не удалось загрузить данные");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const selectedAsset = assets.find((asset) => asset.url === selectedUrl) ?? null;
  const mediaType: SocialMediaType = selectedAsset?.type ?? "image";
  const shopifyConnected = stores.length > 0;

  useEffect(() => {
    if (isLoading) return;
    if (platform === "shopify" && !shopifyConnected) {
      setPlatform(null);
    }
  }, [isLoading, platform, shopifyConnected]);

  const socialTargets = useMemo(
    () =>
      SOCIAL_PLANNER_PLATFORMS.map((id) => {
        const account = accounts.find(
          (item) => item.platform === id && item.status === "connected"
        );
        return {
          id,
          account,
          connected: Boolean(account),
          accepts: acceptsMediaType(id, mediaType),
        };
      }),
    [accounts, mediaType]
  );

  const handleEnhance = async () => {
    if (!platform) {
      setError("Сначала выберите площадку");
      return;
    }

    setIsEnhancing(true);
    setError(null);
    try {
      const platforms: SocialPlatform[] =
        platform === "shopify" ? ["instagram"] : [platform];
      const next = await enhanceCaption({ caption, productName, platforms });
      setCaption(next);
      if (platform === "shopify" && !productDescription.trim()) {
        setProductDescription(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сгенерировать подпись");
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAsset) {
      setError("Выберите фото или видео из генераций");
      return;
    }
    if (!platform) {
      setError("Выберите Facebook, Instagram, TikTok или Shopify");
      return;
    }

    const [year, month, date] = schedule.date.split("-").map(Number);
    const when = combineLocalDateTime(new Date(year, month - 1, date), schedule.time);

    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      setError("Дата публикации должна быть в будущем");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (platform === "shopify") {
        if (!shopDomain) {
          throw new Error("Подключите Shopify store");
        }
        if (!productTitle.trim()) {
          throw new Error("Укажите Product Title");
        }

        const imageUrls =
          selectedAsset.type === "image" ? [selectedAsset.url] : [];

        await publishShopifyProduct({
          shopDomain,
          title: productTitle.trim(),
          description: productDescription.trim() || caption.trim(),
          price: productPrice.trim() || "0.00",
          imageUrls,
          model3dUrl: model3dUrl.trim() || null,
        });

        const created = await insertScheduledPost({
          userId,
          mediaUrl: selectedAsset.url,
          mediaType: selectedAsset.type,
          platform: "shopify",
          accountLabel: shopDomain,
          caption: caption.trim() || productDescription.trim(),
          scheduledAt: when.toISOString(),
          status: "published",
          productTitle: productTitle.trim(),
          productDescription: productDescription.trim(),
          productPrice: productPrice.trim(),
          model3dUrl: model3dUrl.trim() || null,
        });

        onCreated(created);
        onClose();
        return;
      }

      const selectedTarget = socialTargets.find((item) => item.id === platform);
      if (!selectedTarget) {
        throw new Error("Выберите Facebook Page, Instagram или TikTok");
      }
      if (!selectedTarget.accepts) {
        throw new Error(`${findSocialPlatform(platform).title} не принимает этот тип медиа`);
      }

      const nativeSchedule = platform === "facebook" && Boolean(userId);
      const status: ScheduledPost["status"] = nativeSchedule ? "scheduled" : "queued";

      if (nativeSchedule) {
        const publish = await publishAsset({
          mediaUrl: selectedAsset.url,
          mediaType: selectedAsset.type,
          caption: caption.trim(),
          platforms: ["facebook"],
          scheduledAt: when.toISOString(),
        });
        const facebook = publish.results.find((result) => result.platform === "facebook");
        if (facebook?.status === "failed") {
          throw new Error(facebook.error || "Facebook не принял отложенный пост");
        }
      }

      const created = await insertScheduledPost({
        userId,
        mediaUrl: selectedAsset.url,
        mediaType: selectedAsset.type,
        platform,
        accountLabel: selectedTarget.account?.username ?? findSocialPlatform(platform).title,
        caption: caption.trim(),
        scheduledAt: when.toISOString(),
        status,
      });

      onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось запланировать пост");
    } finally {
      setIsSaving(false);
    }
  };

  const shopifyActive = platform === "shopify";
  const inputClass =
    "w-full rounded-xl border border-violet-900/30 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close schedule dialog"
        onClick={() => !isSaving && onClose()}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-modal-title"
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-violet-900/30 bg-[#0b0f19]/90 backdrop-blur-xl shadow-[0_0_25px_rgba(124,58,237,0.3)]"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 border-b border-violet-900/30 bg-[#0b0f19]/95 backdrop-blur">
          <div>
            <h2 id="schedule-modal-title" className="text-base font-semibold text-white">
              Schedule Post
            </h2>
            <p className="text-xs text-slate-400">
              Соцсети или товар в Shopify — генерация, аккаунт и время
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
              Loading planner...
            </div>
          ) : (
            <>
              <section className="space-y-2">
                <h3 className="text-xs font-medium text-slate-400">Media</h3>
                {assets.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-violet-900/40 bg-slate-950/40 p-8 text-center">
                    <ImageIcon className="w-7 h-7 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">Нет генераций. Сначала создайте AI Photo или Video.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {assets.map((asset) => {
                      const selected = selectedUrl === asset.url;
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => setSelectedUrl(asset.url)}
                          className={`relative aspect-square rounded-xl overflow-hidden border bg-slate-950 ${
                            selected
                              ? "border-violet-500 ring-2 ring-violet-500/30"
                              : "border-violet-900/30 hover:border-violet-500/40"
                          }`}
                        >
                          {asset.type === "video" ? (
                            <video src={asset.url} className="h-full w-full object-cover" muted />
                          ) : (
                            <img src={asset.url} alt="" className="h-full w-full object-cover" />
                          )}
                          <span className="absolute bottom-1 left-1 rounded bg-slate-950/80 px-1 py-0.5 text-[9px] text-slate-200 inline-flex items-center gap-1">
                            {asset.type === "video" ? (
                              <Video className="w-2.5 h-2.5" />
                            ) : (
                              <ImageIcon className="w-2.5 h-2.5" />
                            )}
                            {asset.type === "video" ? "Video" : "Photo"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium text-slate-400">Target account</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {socialTargets.map((item) => {
                    const meta = findSocialPlatform(item.id);
                    const active = platform === item.id;
                    const disabled = !item.connected || !item.accepts;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => setPlatform(item.id)}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                          active
                            ? "border-violet-500/40 bg-gradient-to-r from-violet-600/30 via-indigo-600/30 to-purple-600/30 text-white"
                            : "border-violet-900/30 bg-slate-950/40 text-slate-300 hover:border-violet-500/20 hover:bg-white/[0.05]"
                        } ${disabled ? "opacity-40 cursor-not-allowed hover:bg-slate-950/40" : ""}`}
                      >
                        <PlatformTile platform={item.id} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{meta.title}</p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {!item.connected
                              ? "Not connected"
                              : !item.accepts
                                ? "Does not accept this media"
                                : item.account?.username || "Business account"}
                          </p>
                        </div>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    disabled={!shopifyConnected}
                    onClick={() => setPlatform("shopify")}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      shopifyActive
                        ? "border-violet-500/40 bg-gradient-to-r from-violet-600/30 via-indigo-600/30 to-purple-600/30 text-white"
                        : "border-violet-900/30 bg-slate-950/40 text-slate-300 hover:border-violet-500/20 hover:bg-white/[0.05]"
                    } ${!shopifyConnected ? "opacity-40 cursor-not-allowed hover:bg-slate-950/40" : ""}`}
                  >
                    <div className="h-8 w-8 rounded-lg shrink-0 bg-gradient-to-tr from-[#95bf47] to-lime-400 flex items-center justify-center text-white shadow-lg shadow-slate-950/40">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">Shopify</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {shopifyConnected
                          ? shopifyStoreLabel(shopDomain || stores[0]?.shopDomain || "")
                          : "Not connected"}
                      </p>
                    </div>
                  </button>
                </div>
                {(platform === "instagram" || platform === "tiktok") && (
                  <p className="text-[11px] text-amber-300/90">
                    {plannerPlatformLabel(platform)} API не умеет отложенную публикацию —
                    карточка останется в календаре как queued.
                  </p>
                )}
              </section>

              {shopifyActive && shopifyConnected && (
                <section className="space-y-3 rounded-2xl border border-violet-900/30 bg-slate-950/40 p-4">
                  <h3 className="text-xs font-medium text-slate-400">Shopify product</h3>

                  <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {shopifyStoreLabel(shopDomain)}
                      </p>
                      <p className="text-[11px] text-emerald-200/80 truncate">{shopDomain}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                      Active
                    </span>
                  </div>

                  {stores.length > 1 && (
                    <label className="space-y-1 block">
                      <span className="text-[11px] text-slate-500">Store</span>
                      <select
                        value={shopDomain}
                        onChange={(event) => setShopDomain(event.target.value)}
                        className={inputClass}
                      >
                        {stores.map((store) => (
                          <option key={store.id} value={store.shopDomain}>
                            {store.shopDomain}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label className="space-y-1 block">
                    <span className="text-[11px] text-slate-500">Product Title</span>
                    <input
                      value={productTitle}
                      onChange={(event) => setProductTitle(event.target.value)}
                      placeholder="Premium Cardio Syrup"
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-[11px] text-slate-500">Product Description</span>
                    <textarea
                      value={productDescription}
                      onChange={(event) => setProductDescription(event.target.value)}
                      rows={3}
                      placeholder="Short storefront copy..."
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-[11px] text-slate-500">Product Price</span>
                    <input
                      value={productPrice}
                      onChange={(event) => setProductPrice(event.target.value)}
                      placeholder="29.00"
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-[11px] text-slate-500">3D Model Attachment (.glb)</span>
                    {models.length > 0 && (
                      <select
                        value={models.some((model) => model.model_url === model3dUrl) ? model3dUrl : ""}
                        onChange={(event) => setModel3dUrl(event.target.value)}
                        className={`${inputClass} mb-2`}
                      >
                        <option value="">None / paste URL below</option>
                        {models.map((model) => (
                          <option key={model.id} value={model.model_url}>
                            {model.product_name || model.model_url}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      value={model3dUrl}
                      onChange={(event) => setModel3dUrl(event.target.value)}
                      placeholder="https://.../model.glb"
                      className={inputClass}
                    />
                  </label>
                </section>
              )}

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-medium text-slate-400">
                    {shopifyActive ? "Caption / extra copy" : "Caption"}
                  </h3>
                  <button
                    type="button"
                    onClick={handleEnhance}
                    disabled={isEnhancing || !platform}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-600/20 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-600/30 disabled:opacity-50"
                  >
                    {isEnhancing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    Generate AI Caption
                  </button>
                </div>
                <textarea
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  rows={4}
                  placeholder="Write the post copy..."
                  className={inputClass}
                />
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium text-slate-400">Date & time</h3>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-500">Date</span>
                    <input
                      type="date"
                      value={schedule.date}
                      onChange={(event) =>
                        setSchedule((prev) => ({ ...prev, date: event.target.value }))
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-500">Time</span>
                    <input
                      type="time"
                      value={schedule.time}
                      onChange={(event) =>
                        setSchedule((prev) => ({ ...prev, time: event.target.value }))
                      }
                      className={inputClass}
                    />
                  </label>
                </div>
                <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" />
                  Shopify создаёт товар сразу. Facebook умеет native schedule; Instagram и TikTok — queued.
                </p>
              </section>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
              <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <p className="text-xs text-rose-200">{error}</p>
            </div>
          )}
        </div>

        <footer className="sticky bottom-0 flex justify-end gap-2 px-6 py-4 border-t border-violet-900/30 bg-[#0b0f19]/95">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              isSaving ||
              isLoading ||
              !selectedAsset ||
              !platform ||
              (shopifyActive && (!shopifyConnected || !productTitle.trim()))
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-violet-600 via-indigo-500 to-fuchsia-500 shadow-[0_0_25px_rgba(124,58,237,0.3)] disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {shopifyActive ? "Publish to Shopify" : "Schedule Post"}
          </button>
        </footer>
      </div>
    </div>
  );
}
