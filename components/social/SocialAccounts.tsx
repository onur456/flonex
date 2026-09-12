"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertTriangle, Loader2, LogIn, RefreshCw, Send, Share2 } from "lucide-react";
import Link from "next/link";
import {
  SOCIAL_PLATFORMS,
  disconnectedAccount,
  findSocialPlatform,
  type SocialAccount,
  type SocialPlatform,
} from "@/lib/social";
import {
  connectAccount,
  disconnectAccount,
  fetchAccounts,
  updateAutoPublish,
} from "@/lib/socialClient";
import { SocialAccountCard } from "./SocialAccountCard";

interface SocialAccountsProps {
  /** Без входа запросы к `/api/social/*` вернут 401, поэтому показываем приглашение. */
  isSignedIn: boolean;
  /** Открыть модалку публикации для текущей генерации. */
  onPublishRequest?: () => void;
  /** Есть ли готовая генерация, которую можно опубликовать. */
  canPublish?: boolean;
}

function emptyAccounts(): SocialAccount[] {
  return SOCIAL_PLATFORMS.map((platform) => disconnectedAccount(platform.id));
}

export function SocialAccounts({
  isSignedIn,
  onPublishRequest,
  canPublish = false,
}: SocialAccountsProps) {
  const [accounts, setAccounts] = useState<SocialAccount[]>(emptyAccounts);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingPlatform, setPendingPlatform] = useState<SocialPlatform | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadAccounts = useCallback(async () => {
    try {
      const { accounts: loaded } = await fetchAccounts();
      setAccounts(loaded);
      setError(null);
    } catch (err) {
      console.error("Social accounts fetch error:", err);
      setAccounts(emptyAccounts());
      setError(err instanceof Error ? err.message : "Не удалось загрузить аккаунты");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSignedIn) {
      setIsLoading(false);
      return;
    }

    void loadAccounts();
  }, [isSignedIn, loadAccounts]);

  const handleRefresh = () => {
    setIsLoading(true);
    void loadAccounts();
  };

  /** Оптимистично применяем изменение и откатываем его, если запрос упал. */
  const mutateAccount = (
    platform: SocialPlatform,
    optimistic: (account: SocialAccount) => SocialAccount,
    request: () => Promise<unknown>
  ) => {
    const snapshot = accounts;

    setAccounts((prev) =>
      prev.map((account) => (account.platform === platform ? optimistic(account) : account))
    );
    setPendingPlatform(platform);

    startTransition(async () => {
      try {
        await request();
        setError(null);
      } catch (err) {
        console.error("Social account update error:", err);
        setAccounts(snapshot);
        setError(err instanceof Error ? err.message : "Не удалось обновить аккаунт");
      } finally {
        setPendingPlatform(null);
      }
    });
  };

  const handleConnect = (platform: SocialPlatform) => {
    mutateAccount(
      platform,
      (account) => ({ ...account, status: "connected", username: "…" }),
      async () => {
        const { account } = await connectAccount(platform);
        setAccounts((prev) =>
          prev.map((item) => (item.platform === platform ? account : item))
        );
      }
    );
  };

  const handleDisconnect = (platform: SocialPlatform) => {
    mutateAccount(
      platform,
      () => disconnectedAccount(platform),
      () => disconnectAccount(platform)
    );
  };

  const handleToggleAutoPublish = (platform: SocialPlatform, autoPublish: boolean) => {
    mutateAccount(
      platform,
      (account) => ({ ...account, autoPublish }),
      () => updateAutoPublish(platform, autoPublish)
    );
  };

  const connectedCount = accounts.filter((account) => account.status === "connected").length;
  const autoPublishNames = accounts
    .filter((account) => account.autoPublish)
    .map((account) => findSocialPlatform(account.platform).title);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Share2 className="w-4 h-4 text-indigo-400" /> Social Connections
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Подключите аккаунты, чтобы публиковать генерации без выгрузки файлов.
          </p>
        </div>

        {isSignedIn && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 transition inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>

            {onPublishRequest && (
              <button
                type="button"
                onClick={onPublishRequest}
                disabled={!canPublish || connectedCount === 0}
                title={
                  connectedCount === 0
                    ? "Сначала подключите хотя бы один аккаунт"
                    : !canPublish
                      ? "Сначала сгенерируйте фото или видео"
                      : undefined
                }
                className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                Publish Latest
              </button>
            )}
          </div>
        )}
      </div>

      {!isSignedIn ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-10 flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-500">
            <LogIn className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-300">Войдите, чтобы подключить соцсети</p>
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
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-rose-300">
                  Ошибка синхронизации аккаунтов
                </p>
                <p className="text-[11px] text-rose-200/80 mt-1 break-words">{error}</p>
              </div>
            </div>
          )}

          {isLoading && connectedCount === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-10 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <p className="text-xs text-slate-400">Загружаем подключённые аккаунты...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {accounts.map((account) => (
                <SocialAccountCard
                  key={account.platform}
                  account={account}
                  isPending={isPending && pendingPlatform === account.platform}
                  onConnect={() => handleConnect(account.platform)}
                  onDisconnect={() => handleDisconnect(account.platform)}
                  onToggleAutoPublish={(enabled) =>
                    handleToggleAutoPublish(account.platform, enabled)
                  }
                />
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5">
            <p className="text-xs font-semibold text-slate-300">
              {connectedCount} of {SOCIAL_PLATFORMS.length} accounts connected
            </p>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
              {autoPublishNames.length > 0
                ? `Авто-публикация включена: ${autoPublishNames.join(", ")}. Новые генерации будут уходить в эти аккаунты автоматически.`
                : "Авто-публикация выключена — каждую генерацию нужно отправлять вручную через Publish."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
