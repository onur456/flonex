"use client";

import { ShoppingBag } from "lucide-react";
import { PlatformIcon } from "@/components/social/PlatformIcon";
import type { PlannerPlatform } from "@/lib/planner";

export function PlannerPlatformIcon({
  platform,
  className = "w-4 h-4",
}: {
  platform: PlannerPlatform;
  className?: string;
}) {
  if (platform === "shopify") {
    return <ShoppingBag className={className} />;
  }

  return <PlatformIcon platform={platform} className={className} />;
}
