"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export const GLASS_TAB_GROUP =
  "rounded-2xl border border-violet-900/30 bg-[#0b0f19]/60 backdrop-blur-md";

const ACTIVE_PILL =
  "absolute inset-0 rounded-xl bg-gradient-to-r from-violet-600/30 via-indigo-600/30 to-purple-600/30 backdrop-blur-xl border border-violet-500/40 shadow-[0_0_25px_rgba(124,58,237,0.3)]";

const TAB_TRANSITION = { type: "spring" as const, stiffness: 400, damping: 30 };

interface GlassTabButtonProps {
  active: boolean;
  layoutId: string;
  onClick?: () => void;
  disabled?: boolean;
  stretch?: boolean;
  children: ReactNode;
}

export function GlassTabButton({
  active,
  layoutId,
  onClick,
  disabled,
  stretch = false,
  children,
}: GlassTabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      className={`relative isolate z-0 flex items-center rounded-xl text-sm border transition-colors ${
        stretch ? "w-full justify-start px-3 py-2.5" : "px-6 py-2.5"
      } ${
        active
          ? "border-transparent text-white font-semibold"
          : "border-transparent text-slate-400 hover:border-violet-500/20 hover:bg-white/[0.05] hover:text-slate-200"
      } ${disabled ? "cursor-default hover:border-transparent hover:bg-transparent hover:text-slate-400" : ""}`}
    >
      {active ? (
        <motion.div
          layoutId={layoutId}
          className={ACTIVE_PILL}
          transition={TAB_TRANSITION}
        />
      ) : null}
      <span
        className={`relative z-10 inline-flex items-center ${
          stretch ? "gap-3" : "gap-2"
        }`}
      >
        {children}
      </span>
    </button>
  );
}
