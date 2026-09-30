"use client";

import {
  CheckCircle2,
  CircleDashed,
  Clock,
  Link2,
  Loader2,
  Send,
  Unlink,
  type LucideIcon,
} from "lucide-react";

export type StoreCardStatus = "connected" | "disconnected" | "coming_soon";

interface StoreIntegrationCardProps {
  title: string;
  subtitle: string;
  accent: string;
  icon: LucideIcon;
  status: StoreCardStatus;
  connectedLabel?: string | null;
  shopInput?: string;
  onShopInputChange?: (value: string) => void;
  showShopInput?: boolean;
  shopInputDisabled?: boolean;
  onPublish?: () => void;
  publishDisabled?: boolean;
  publishTitle?: string;
  actionLabel: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  isPending?: boolean;
  actionVariant?: "connect" | "disconnect" | "disabled";
}

export function StoreIntegrationCard({
  title,
  subtitle,
  accent,
  icon: Icon,
  status,
  connectedLabel,
  shopInput = "",
  onShopInputChange,
  showShopInput = false,
  shopInputDisabled = false,
  onPublish,
  publishDisabled = false,
  publishTitle,
  actionLabel,
  onAction,
  actionDisabled = false,
  isPending = false,
  actionVariant = "connect",
}: StoreIntegrationCardProps) {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div
          className={`h-11 w-11 rounded-xl shrink-0 bg-gradient-to-tr ${accent} flex items-center justify-center text-white shadow-lg shadow-slate-950/40`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-100 truncate">{title}</h3>
          <p className="text-[11px] text-slate-400">{subtitle}</p>
        </div>
      </div>

      {status === "connected" ? (
        <div className="inline-flex items-center gap-2 self-start pl-1 pr-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-emerald-500 to-lime-400 flex items-center justify-center text-[10px] font-bold text-white">
            {(connectedLabel ?? "S").charAt(0).toUpperCase()}
          </div>
          <span className="text-[11px] font-medium text-emerald-300 max-w-[150px] truncate">
            {connectedLabel}
          </span>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        </div>
      ) : status === "coming_soon" ? (
        <div className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-medium text-amber-300">COMING SOON</span>
        </div>
      ) : (
        <div className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full bg-slate-500/10 border border-slate-600/40">
          <CircleDashed className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[11px] font-medium text-slate-400">NOT CONNECTED</span>
        </div>
      )}

      {showShopInput && (
        <input
          value={shopInput}
          onChange={(event) => onShopInputChange?.(event.target.value)}
          disabled={shopInputDisabled}
          placeholder="your-store.myshopify.com"
          className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 disabled:opacity-60"
        />
      )}

      <div className="mt-auto flex flex-col gap-4">
        <button
          type="button"
          onClick={onPublish}
          disabled={publishDisabled || isPending}
          title={
            publishTitle ??
            (publishDisabled
              ? "Connect store first to publish"
              : `Publish product to ${title}`)
          }
          className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-95 transition inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:opacity-40"
        >
          <Send className="w-3.5 h-3.5" />
          Publish Product
        </button>

        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled || isPending || actionVariant === "disabled"}
          className={`w-full py-2.5 rounded-xl text-xs font-semibold transition inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${
            actionVariant === "disconnect"
              ? "bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/40 text-slate-200 hover:text-rose-200"
              : "bg-indigo-600 hover:bg-indigo-500 text-white"
          }`}
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : actionVariant === "disconnect" ? (
            <Unlink className="w-3.5 h-3.5" />
          ) : (
            <Link2 className="w-3.5 h-3.5" />
          )}
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
