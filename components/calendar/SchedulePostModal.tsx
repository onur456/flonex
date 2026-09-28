"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Image as ImageIcon,
  Loader2,
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
import { enhanceCaption, fetchAccounts, publishAsset } from "@/lib/socialClient";
import {
  acceptsMediaType,
  findSocialPlatform,
  type SocialAccount,
  type SocialMediaType,
  type SocialPlatform,
} from "@/lib/social";
import { PlatformTile } from "@/components/social/PlatformIcon";

const PLANNER_PLATFORMS: SocialPlatform[] = ["facebook", "instagram"];

interface SchedulePostModalProps {
  day: Date;
  userId: string | null;
  productName?: string;
  onClose: () => void;
  onCreated: (post: ScheduledPost) => void;
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
  onClose,
  onCreated,
}: SchedulePostModalProps) {
  const [assets, setAssets] = useState<GenerationAsset[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [platform, setPlatform] = useState<SocialPlatform | null>(null);
  const [caption, setCaption] = useState("");
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
        const [loadedAssets, accountPayload] = await Promise.all([
          fetchGenerationAssets(24).catch(() => [] as GenerationAsset[]),
          userId
            ? fetchAccounts().catch(() => ({ accounts: [] as SocialAccount[] }))
            : Promise.resolve({ accounts: [] as SocialAccount[] }),
        ]);

        if (cancelled) return;
        setAssets(loadedAssets);
        setAccounts(accountPayload.accounts);
        setSelectedUrl((current) => current ?? loadedAssets[0]?.url ?? null);
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

  const connected = useMemo(
    () =>
      PLANNER_PLATFORMS.map((id) => {
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

  const selectedTarget = connected.find((item) => item.id === platform);

  const handleEnhance = async () => {
    if (!platform) {
      setError("Сначала выберите Facebook или Instagram");
      return;
    }

    setIsEnhancing(true);
    setError(null);
    try {
      setCaption(
        await enhanceCaption({
          caption,
          productName,
          platforms: [platform],
        })
      );
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
    if (!platform || !selectedTarget) {
      setError("Выберите Facebook Page или Instagram");
      return;
    }
    if (!selectedTarget.accepts) {
      setError(`${findSocialPlatform(platform).title} не принимает этот тип медиа`);
      return;
    }

    const [year, month, date] = schedule.date.split("-").map(Number);
    const when = combineLocalDateTime(
      new Date(year, month - 1, date),
      schedule.time
    );

    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      setError("Дата публикации должна быть в будущем");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const nativeSchedule = platform === "facebook" && Boolean(userId);
      let status: ScheduledPost["status"] = nativeSchedule ? "scheduled" : "queued";

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
              Выберите генерацию, аккаунт и время публикации
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {connected.map((item) => {
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
                </div>
                {platform === "instagram" && (
                  <p className="text-[11px] text-amber-300/90">
                    Instagram API не ставит посты в очередь — карточка останется в календаре как queued.
                  </p>
                )}
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-medium text-slate-400">Caption</h3>
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
                  className="w-full rounded-xl border border-violet-900/30 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
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
                      className="w-full rounded-xl border border-violet-900/30 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-violet-500/50"
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
                      className="w-full rounded-xl border border-violet-900/30 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-violet-500/50"
                    />
                  </label>
                </div>
                <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" />
                  Facebook native schedule: 10 minutes – 30 days. Planner keeps Instagram locally.
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
            disabled={isSaving || isLoading || !selectedAsset || !platform}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-violet-600 via-indigo-500 to-fuchsia-500 shadow-[0_0_25px_rgba(124,58,237,0.3)] disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Schedule Post
          </button>
        </footer>
      </div>
    </div>
  );
}
