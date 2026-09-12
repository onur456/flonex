import { Camera, Music2, ThumbsUp, type LucideIcon } from "lucide-react";
import { findSocialPlatform, type SocialPlatform } from "@/lib/social";

/**
 * В lucide 1.x бренд-иконки удалены, поэтому каждой платформе подобран
 * ближайший смысловой значок.
 */
const PLATFORM_ICONS: Record<SocialPlatform, LucideIcon> = {
  instagram: Camera,
  facebook: ThumbsUp,
  tiktok: Music2,
};

interface PlatformIconProps {
  platform: SocialPlatform;
  className?: string;
}

/** Только значок, без плитки — для чекбоксов и компактных списков. */
export function PlatformIcon({ platform, className = "w-4 h-4" }: PlatformIconProps) {
  const Icon = PLATFORM_ICONS[platform];
  return <Icon className={className} />;
}

interface PlatformTileProps {
  platform: SocialPlatform;
  size?: "sm" | "md";
}

/** Значок платформы на её акцентном градиенте. */
export function PlatformTile({ platform, size = "md" }: PlatformTileProps) {
  const meta = findSocialPlatform(platform);
  const box = size === "sm" ? "h-8 w-8 rounded-lg" : "h-11 w-11 rounded-xl";
  const icon = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <div
      className={`${box} shrink-0 bg-gradient-to-tr ${meta.accent} flex items-center justify-center text-white shadow-lg shadow-slate-950/40`}
    >
      <PlatformIcon platform={platform} className={icon} />
    </div>
  );
}
