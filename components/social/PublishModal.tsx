"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import {
  SOCIAL_PLATFORMS,
  acceptsMediaType,
  findSocialPlatform,
  type PublishPayload,
  type PublishTargetResult,
  type SocialAccount,
  type SocialMediaType,
  type SocialPlatform,
} from "@/lib/social";
import { enhanceCaption, fetchAccounts, publishAsset } from "@/lib/socialClient";
import { PlatformIcon, PlatformTile } from "./PlatformIcon";

export interface PublishMedia {
  url: string;
  type: SocialMediaType;
}

interface PublishModalProps {
  onClose: () => void;
  media: PublishMedia;
  /** Подставляется в подпись, когда пользователь просит AI-вариант. */
  productName?: string;
}

type ScheduleMode = "now" | "later";

/** Дата и время по умолчанию для отложенной публикации — через час. */
function defaultSchedule() {
  const target = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");

  return {
    date: `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`,
    time: `${pad(target.getHours())}:${pad(target.getMinutes())}`,
  };
}

/**
 * Модалка монтируется только на время публикации, поэтому состояние не нужно
 * сбрасывать эффектами — достаточно начальных значений.
 */
export function PublishModal({ onClose, media, productName }: PublishModalProps) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [caption, setCaption] = useState("");
  /** `null` — пользователь ещё не трогал выбор, показываем платформы по умолчанию. */
  const [selection, setSelection] = useState<SocialPlatform[] | null>(null);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("now");
  const [schedule, setSchedule] = useState(defaultSchedule);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [results, setResults] = useState<PublishTargetResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchAccounts()
      .then((data) => {
        if (cancelled) return;
        setAccounts(data.accounts);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Social accounts fetch error:", err);
        setError(err instanceof Error ? err.message : "Не удалось загрузить аккаунты");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAccounts(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPublishing) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPublishing, onClose]);

  const isConnected = useCallback(
    (platform: SocialPlatform) =>
      accounts.some(
        (account) => account.platform === platform && account.status === "connected"
      ),
    [accounts]
  );

  const isAvailable = useCallback(
    (platform: SocialPlatform) =>
      isConnected(platform) && acceptsMediaType(platform, media.type),
    [isConnected, media.type]
  );

  /** По умолчанию выбраны все аккаунты, готовые принять этот тип медиа. */
  const selected =
    selection ?? SOCIAL_PLATFORMS.map((platform) => platform.id).filter(isAvailable);

  const togglePlatform = (platform: SocialPlatform) => {
    setSelection(
      selected.includes(platform)
        ? selected.filter((item) => item !== platform)
        : [...selected, platform]
    );
  };

  /** Самый строгий лимит среди выбранных платформ. */
  const captionLimit = selected.length
    ? Math.min(...selected.map((platform) => findSocialPlatform(platform).captionLimit))
    : Math.max(...SOCIAL_PLATFORMS.map((platform) => platform.captionLimit));

  const isCaptionTooLong = caption.trim().length > captionLimit;

  const handleEnhanceCaption = async () => {
    setIsEnhancing(true);
    try {
      setCaption(await enhanceCaption({ caption, productName, platforms: selected }));
      setError(null);
    } catch (err) {
      console.error("Caption enhance error:", err);
      setError(err instanceof Error ? err.message : "Не удалось улучшить подпись");
    } finally {
      setIsEnhancing(false);
    }
  };

  const handlePublish = async () => {
    let scheduledAt: string | null = null;

    if (scheduleMode === "later") {
      const parsed = new Date(`${schedule.date}T${schedule.time}`);

      if (Number.isNaN(parsed.getTime())) {
        setError("Укажите корректную дату и время публикации");
        return;
      }

      if (parsed.getTime() <= Date.now()) {
        setError("Дата публикации должна быть в будущем");
        return;
      }

      scheduledAt = parsed.toISOString();
    }

    const payload: PublishPayload = {
      mediaUrl: media.url,
      mediaType: media.type,
      caption: caption.trim(),
      platforms: selected,
      scheduledAt,
    };

    setIsPublishing(true);
    setError(null);

    try {
      const data = await publishAsset(payload);
      setResults(data.results);
    } catch (err) {
      console.error("Publish error:", err);
      setError(err instanceof Error ? err.message : "Не удалось опубликовать");
    } finally {
      setIsPublishing(false);
    }
  };

  const canSubmit = selected.length > 0 && !isCaptionTooLong && !isPublishing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close publish dialog"
        onClick={() => !isPublishing && onClose()}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-modal-title"
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
          <div>
            <h2 id="publish-modal-title" className="text-base font-semibold text-slate-100">
              Publish to Social
            </h2>
            <p className="text-xs text-slate-400">
              {media.type === "video" ? "Kling AI video" : "AI photo"} · выберите площадки и время
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPublishing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-6 space-y-6">
          {/* CONTENT PREVIEW + CAPTION */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-5">
            <div className="sm:col-span-2 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 h-48 sm:h-full min-h-[12rem]">
              {media.type === "video" ? (
                <video
                  src={media.url}
                  controls
                  playsInline
                  className="w-full h-full object-contain bg-black"
                />
              ) : (
                <img src={media.url} alt="Asset preview" className="w-full h-full object-cover" />
              )}
            </div>

            <div className="sm:col-span-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="publish-caption"
                  className="text-xs text-slate-400 font-medium"
                >
                  Caption & hashtags
                </label>
                <button
                  type="button"
                  onClick={handleEnhanceCaption}
                  disabled={isEnhancing || isPublishing}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[11px] font-semibold transition active:scale-95 disabled:opacity-50"
                >
                  {isEnhancing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  AI Enhance Caption
                </button>
              </div>

              <textarea
                id="publish-caption"
                rows={7}
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                disabled={isPublishing}
                placeholder="Расскажите о товаре и добавьте хэштеги, или нажмите AI Enhance Caption..."
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/80 transition resize-none disabled:opacity-60"
              />

              <p
                className={`text-[10px] text-right ${
                  isCaptionTooLong ? "text-rose-400" : "text-slate-500"
                }`}
              >
                {caption.trim().length} / {captionLimit}
              </p>
            </div>
          </div>

          {/* PLATFORM SELECTOR */}
          <fieldset className="space-y-2">
            <legend className="text-xs text-slate-400 font-medium mb-2">Platforms</legend>

            {isLoadingAccounts ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 px-1 py-3">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Проверяем подключённые аккаунты...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {SOCIAL_PLATFORMS.map((platform) => {
                  const available = isAvailable(platform.id);
                  const checked = selected.includes(platform.id);
                  const reason = !isConnected(platform.id)
                    ? "Не подключён"
                    : !acceptsMediaType(platform.id, media.type)
                      ? media.type === "video"
                        ? "Не принимает видео"
                        : "Только видео"
                      : null;

                  return (
                    <label
                      key={platform.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                        !available
                          ? "border-slate-800 bg-slate-950/40 opacity-50 cursor-not-allowed"
                          : checked
                            ? "border-indigo-500/60 bg-indigo-600/15 cursor-pointer"
                            : "border-slate-800 bg-slate-950/60 hover:border-slate-700 cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!available || isPublishing}
                        onChange={() => togglePlatform(platform.id)}
                        className="h-3.5 w-3.5 accent-indigo-500 disabled:cursor-not-allowed"
                      />
                      <PlatformTile platform={platform.id} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-200 truncate">
                          {platform.title}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {reason ?? platform.subtitle}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          {/* SCHEDULE */}
          <fieldset className="space-y-2.5">
            <legend className="text-xs text-slate-400 font-medium mb-2">Schedule</legend>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(
                [
                  { mode: "now", title: "Publish Now", hint: "Уйдёт в очередь сразу" },
                  { mode: "later", title: "Schedule for Later", hint: "Выберите дату и время" },
                ] as const
              ).map((option) => (
                <label
                  key={option.mode}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    scheduleMode === option.mode
                      ? "border-indigo-500/60 bg-indigo-600/15"
                      : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="publish-schedule"
                    value={option.mode}
                    checked={scheduleMode === option.mode}
                    disabled={isPublishing}
                    onChange={() => setScheduleMode(option.mode)}
                    className="h-3.5 w-3.5 accent-indigo-500"
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-200">{option.title}</p>
                    <p className="text-[10px] text-slate-500">{option.hint}</p>
                  </div>
                </label>
              ))}
            </div>

            {scheduleMode === "later" && (
              <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <label
                    htmlFor="publish-date"
                    className="text-[10px] text-slate-400 font-medium block mb-1"
                  >
                    Date
                  </label>
                  <input
                    id="publish-date"
                    type="date"
                    value={schedule.date}
                    disabled={isPublishing}
                    onChange={(event) =>
                      setSchedule((prev) => ({ ...prev, date: event.target.value }))
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/80 transition"
                  />
                </div>
                <div>
                  <label
                    htmlFor="publish-time"
                    className="text-[10px] text-slate-400 font-medium block mb-1"
                  >
                    Time
                  </label>
                  <input
                    id="publish-time"
                    type="time"
                    value={schedule.time}
                    disabled={isPublishing}
                    onChange={(event) =>
                      setSchedule((prev) => ({ ...prev, time: event.target.value }))
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/80 transition"
                  />
                </div>
              </div>
            )}
          </fieldset>

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <p className="text-xs text-rose-200 break-words">{error}</p>
            </div>
          )}

          {results && (
            <ul className="space-y-2">
              {results.map((result) => {
                const meta = findSocialPlatform(result.platform);
                const failed = result.status === "failed";

                return (
                  <li
                    key={result.platform}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      failed
                        ? "border-rose-500/30 bg-rose-500/10"
                        : "border-emerald-500/30 bg-emerald-500/10"
                    }`}
                  >
                    <PlatformIcon
                      platform={result.platform}
                      className={`w-4 h-4 shrink-0 ${
                        failed ? "text-rose-400" : "text-emerald-400"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-200">{meta.title}</p>
                      <p
                        className={`text-[10px] ${
                          failed ? "text-rose-200/80" : "text-emerald-200/80"
                        }`}
                      >
                        {failed
                          ? result.error
                          : result.status === "scheduled"
                            ? "Запланировано"
                            : "Опубликовано"}
                      </p>
                    </div>
                    {result.permalink && (
                      <a
                        href={result.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1 shrink-0"
                      >
                        Открыть <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="sticky bottom-0 flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-800 bg-slate-900/95 backdrop-blur">
          <button
            type="button"
            onClick={onClose}
            disabled={isPublishing}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
          >
            {results ? "Close" : "Cancel"}
          </button>

          {!results && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={!canSubmit}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-95 transition inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Отправляем...
                </>
              ) : scheduleMode === "later" ? (
                <>
                  <CalendarClock className="w-3.5 h-3.5" />
                  Schedule
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Publish Now
                </>
              )}
            </button>
          )}

          {results && (
            <span className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" /> Готово
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}
