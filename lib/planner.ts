import type { SocialPlatform } from "./social";

export type PlannerPlatform = SocialPlatform | "shopify";

export function isPlannerPlatform(value: unknown): value is PlannerPlatform {
  return (
    value === "instagram" ||
    value === "facebook" ||
    value === "tiktok" ||
    value === "shopify"
  );
}

export function plannerPlatformLabel(platform: PlannerPlatform): string {
  if (platform === "shopify") return "Shopify";
  if (platform === "instagram") return "Instagram";
  if (platform === "facebook") return "Facebook Pages";
  return "TikTok";
}
