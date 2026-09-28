"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export const GLASS_TAB_GROUP =
  "rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md";

const ACTIVE_PILL =
  "absolute inset-0 rounded-xl bg-white/10 backdrop-blur-lg border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]";

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
      className={`relative isolate z-0 flex items-center rounded-xl text-sm ${
        stretch ? "w-full justify-start px-3 py-2.5" : "px-6 py-2.5"
      } ${
        active
          ? "text-white font-medium"
          : "text-zinc-400 hover:text-zinc-200 transition-colors"
      } ${disabled ? "cursor-default hover:text-zinc-400" : ""}`}
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
