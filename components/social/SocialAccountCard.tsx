"use client";

import { CheckCircle2, CircleDashed, Link2, Loader2, Send, Unlink } from "lucide-react";
import { findSocialPlatform, type SocialAccount } from "@/lib/social";
import { PlatformTile } from "./PlatformIcon";

interface SocialAccountCardProps {
  account: SocialAccount;
  isPending: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onPublish: () => void;
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
  onConnect,
  onDisconnect,
  onPublish,
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

      <button
        type="button"
        onClick={onPublish}
        disabled={!isConnected || isPending}
        title={isConnected ? `Publish to ${meta.title}` : "Connect account first to publish"}
        className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-95 transition inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:opacity-40"
      >
        <Send className="w-3.5 h-3.5" />
        Publish Post
      </button>

      <button
        type="button"
        onClick={isConnected ? onDisconnect : onConnect}
        disabled={isPending}
        className={`w-full py-2.5 rounded-xl text-xs font-semibold transition inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${
          isConnected
            ? "bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/40 text-slate-200 hover:text-rose-200"
            : "bg-indigo-600 hover:bg-indigo-500 text-white"
        }`}
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isConnected ? (
          <Unlink className="w-3.5 h-3.5" />
        ) : (
          <Link2 className="w-3.5 h-3.5" />
        )}
        {isConnected ? "Disconnect" : `Connect ${meta.title}`}
      </button>
    </div>
  );
}
