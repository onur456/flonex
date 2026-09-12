export type SocialPlatform = "instagram" | "facebook" | "tiktok";

export type SocialMediaType = "image" | "video";

export interface SocialPlatformMeta {
  id: SocialPlatform;
  title: string;
  subtitle: string;
  /** Классы Tailwind для акцентного градиента плитки платформы. */
  accent: string;
  /** Максимальная длина подписи, которую принимает платформа. */
  captionLimit: number;
  /** Какие типы медиа платформа готова принять. */
  accepts: SocialMediaType[];
}

export const SOCIAL_PLATFORMS: SocialPlatformMeta[] = [
  {
    id: "instagram",
    title: "Instagram",
    subtitle: "Feed posts & Reels",
    accent: "from-pink-500 via-rose-500 to-amber-500",
    captionLimit: 2200,
    accepts: ["image", "video"],
  },
  {
    id: "facebook",
    title: "Facebook Pages",
    subtitle: "Page posts & Stories",
    accent: "from-blue-600 via-blue-500 to-sky-400",
    captionLimit: 5000,
    accepts: ["image", "video"],
  },
  {
    id: "tiktok",
    title: "TikTok",
    subtitle: "Short-form video only",
    accent: "from-cyan-400 via-slate-200 to-rose-500",
    captionLimit: 2200,
    accepts: ["video"],
  },
];

export interface SocialAccount {
  platform: SocialPlatform;
  status: "connected" | "disconnected";
  /** Заполнено только у подключённых аккаунтов. */
  username: string | null;
  avatarUrl: string | null;
  autoPublish: boolean;
  connectedAt: string | null;
}

export interface PublishPayload {
  mediaUrl: string;
  mediaType: SocialMediaType;
  caption: string;
  platforms: SocialPlatform[];
  /** ISO-строка для отложенной публикации, `null` — публикуем сразу. */
  scheduledAt: string | null;
}

export interface PublishTargetResult {
  platform: SocialPlatform;
  status: "published" | "scheduled" | "failed";
  permalink: string | null;
  error: string | null;
}

export interface PublishResponse {
  success: boolean;
  results: PublishTargetResult[];
  error?: string;
}

export function isSocialPlatform(value: unknown): value is SocialPlatform {
  return SOCIAL_PLATFORMS.some((platform) => platform.id === value);
}

export function findSocialPlatform(id: SocialPlatform): SocialPlatformMeta {
  const meta = SOCIAL_PLATFORMS.find((platform) => platform.id === id);
  if (!meta) {
    throw new Error(`Unknown social platform: ${id}`);
  }
  return meta;
}

export function acceptsMediaType(
  platform: SocialPlatform,
  mediaType: SocialMediaType
): boolean {
  return findSocialPlatform(platform).accepts.includes(mediaType);
}

export function disconnectedAccount(platform: SocialPlatform): SocialAccount {
  return {
    platform,
    status: "disconnected",
    username: null,
    avatarUrl: null,
    autoPublish: false,
    connectedAt: null,
  };
}
