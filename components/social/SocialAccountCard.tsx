"use client";

import { CheckCircle2, CircleDashed, Link2, Loader2, Unlink } from "lucide-react";
import { findSocialPlatform, type SocialAccount } from "@/lib/social";
import { PlatformTile } from "./PlatformIcon";
import { ToggleSwitch } from "./ToggleSwitch";

interface SocialAccountCardProps {
  account: SocialAccount;
  isPending: boolean;
  /** OAuth-переход делаем ссылкой: реальный провайдер уводит со страницы. */
  connectHref: string;
  onDisconnect: () => void;
  onToggleAutoPublish: (enabled: boolean) => void;
}

function AccountAvatar({ account }: { account: SocialAccount }) {
  const initial = (account.username ?? "?").replace(/^@/, "").charAt(0).toUpperCase();

  if (account.avatarUrl) {
    return (
      <img
        src={account.avatarUrl}
        alt={account.username ?? "Account avatar"}
        className="h-6 w-6 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-bold text-white">
      {initial}
    </div>
  );
}

export function SocialAccountCard({
  account,
  isPending,
  connectHref,
  onDisconnect,
  onToggleAutoPublish,
}: SocialAccountCardProps) {
  const meta = findSocialPlatform(account.platform);
  const isConnected = account.status === "connected";

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <PlatformTile platform={account.platform} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-100 truncate">{meta.title}</h3>
          <p className="text-[11px] text-slate-400 truncate">{meta.subtitle}</p>
        </div>
      </div>

      {isConnected ? (
        <div className="inline-flex items-center gap-2 self-start pl-1 pr-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <AccountAvatar account={account} />
          <span className="text-[11px] font-medium text-emerald-300 max-w-[150px] truncate">
            {account.username}
          </span>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        </div>
      ) : (
        <div className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full bg-slate-500/10 border border-slate-600/40">
          <CircleDashed className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[11px] font-medium text-slate-400">Not Connected</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-200">Auto-Publish Mode</p>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            {isConnected
              ? "Публиковать каждую новую генерацию сразу"
              : "Доступно после подключения аккаунта"}
          </p>
        </div>
        <ToggleSwitch
          label={`Auto-publish to ${meta.title}`}
          checked={account.autoPublish}
          disabled={!isConnected || isPending}
          onChange={onToggleAutoPublish}
        />
      </div>

      {isConnected ? (
        <button
          type="button"
          onClick={onDisconnect}
          disabled={isPending}
          className="w-full py-2.5 rounded-xl text-xs font-semibold transition inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/40 text-slate-200 hover:text-rose-200 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Unlink className="w-3.5 h-3.5" />
          )}
          Disconnect
        </button>
      ) : (
        <a
          href={connectHref}
          className="w-full py-2.5 rounded-xl text-xs font-semibold transition inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
        >
          <Link2 className="w-3.5 h-3.5" />
          Connect {meta.title}
        </a>
      )}
    </div>
  );
}
