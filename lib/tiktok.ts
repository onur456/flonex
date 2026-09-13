import { appOrigin } from "./meta";
import type { SocialMediaType } from "./social";

/**
 * TikTok Login Kit + Content Posting API.
 * Access-токен живёт около суток, refresh — до года. Публикация идёт
 * `PULL_FROM_URL`: TikTok сам скачивает файл с нашего домена, поэтому
 * `flonex.vercel.app` должен быть верифицирован в URL properties.
 *
 * Непроверенное приложение может постить только в SELF_ONLY — это ограничение
 * TikTok, а не нашей логики. После App Review появится PUBLIC_TO_EVERYONE.
 */
const OPEN_API = "https://open.tiktokapis.com";

export const tiktokClientKey = process.env.TIKTOK_CLIENT_KEY?.trim() || "";
export const tiktokClientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim() || "";
export const isTikTokConfigured = Boolean(tiktokClientKey && tiktokClientSecret);

export const TIKTOK_CALLBACK_PATH = "/api/social/oauth/tiktok/callback";

export const TIKTOK_SCOPES = [
  "user.info.basic",
  "user.info.profile",
  "video.publish",
];

export function tiktokRedirectUri(requestUrl: string): string {
  return `${appOrigin(requestUrl)}${TIKTOK_CALLBACK_PATH}`;
}

export function buildTikTokAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_key: tiktokClientKey,
    response_type: "code",
    scope: TIKTOK_SCOPES.join(","),
    redirect_uri: redirectUri,
    state,
  });

  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}

interface TikTokErrorBody {
  error?: string | { code?: string; message?: string };
  error_description?: string;
  message?: string;
}

function tiktokError(status: number, body: unknown): Error {
  const record = (body ?? {}) as TikTokErrorBody;
  const nested = typeof record.error === "object" ? record.error : null;
  const message =
    record.error_description ||
    nested?.message ||
    (typeof record.error === "string" ? record.error : null) ||
    record.message ||
    `TikTok ответил ${status}`;

  return new Error(nested?.code ? `${message} (${nested.code})` : message);
}

async function tiktokFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw tiktokError(res.status, body);
  }

  const nested = (body as TikTokErrorBody | null)?.error;
  if (nested && typeof nested === "object" && nested.code && nested.code !== "ok") {
    throw tiktokError(res.status, body);
  }

  return body as T;
}

export interface TikTokTokens {
  accessToken: string;
  refreshToken: string | null;
  openId: string;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  open_id?: string;
  error?: string;
  error_description?: string;
}

async function parseTokenResponse(data: TokenResponse): Promise<TikTokTokens> {
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || "TikTok не вернула access_token");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    openId: data.open_id ?? "",
  };
}

export async function exchangeTikTokCode(
  code: string,
  redirectUri: string
): Promise<TikTokTokens> {
  const data = await tiktokFetch<TokenResponse>(`${OPEN_API}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: tiktokClientKey,
      client_secret: tiktokClientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }).toString(),
  });

  return parseTokenResponse(data);
}

export async function refreshTikTokToken(refreshToken: string): Promise<TikTokTokens> {
  const data = await tiktokFetch<TokenResponse>(`${OPEN_API}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: tiktokClientKey,
      client_secret: tiktokClientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  return parseTokenResponse(data);
}

export interface TikTokProfile {
  openId: string;
  username: string | null;
  avatarUrl: string | null;
}

export async function fetchTikTokProfile(accessToken: string): Promise<TikTokProfile> {
  const params = new URLSearchParams({
    fields: "open_id,display_name,avatar_url,username",
  });

  const data = await tiktokFetch<{
    data?: { user?: { open_id?: string; display_name?: string; avatar_url?: string; username?: string } };
  }>(`${OPEN_API}/v2/user/info/?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const user = data.data?.user;
  const handle = user?.username || user?.display_name;

  return {
    openId: user?.open_id ?? "",
    username: handle ? (handle.startsWith("@") ? handle : `@${handle}`) : null,
    avatarUrl: user?.avatar_url ?? null,
  };
}

type PrivacyLevel =
  | "PUBLIC_TO_EVERYONE"
  | "MUTUAL_FOLLOW_FRIENDS"
  | "FOLLOWER_OF_CREATOR"
  | "SELF_ONLY";

const PRIVACY_PREFERENCE: PrivacyLevel[] = [
  "PUBLIC_TO_EVERYONE",
  "FOLLOWER_OF_CREATOR",
  "MUTUAL_FOLLOW_FRIENDS",
  "SELF_ONLY",
];

interface CreatorInfo {
  privacy_level_options?: string[];
}

async function queryCreatorInfo(accessToken: string): Promise<CreatorInfo> {
  const data = await tiktokFetch<{ data?: CreatorInfo }>(
    `${OPEN_API}/v2/post/publish/creator_info/query/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: "{}",
    }
  );

  return data.data ?? {};
}

function pickPrivacyLevel(options: string[] | undefined): PrivacyLevel {
  const allowed = new Set(options ?? []);

  for (const level of PRIVACY_PREFERENCE) {
    if (allowed.has(level)) return level;
  }

  // Непроверенное приложение обычно отдаёт только SELF_ONLY.
  return "SELF_ONLY";
}

export interface TikTokPublishInput {
  accessToken: string;
  mediaUrl: string;
  mediaType: SocialMediaType;
  caption: string;
}

export interface TikTokPublishResult {
  id: string;
  permalink: string | null;
}

async function initPublish(
  path: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<string> {
  const data = await tiktokFetch<{ data?: { publish_id?: string } }>(
    `${OPEN_API}${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(body),
    }
  );

  const publishId = data.data?.publish_id;
  if (!publishId) {
    throw new Error("TikTok не вернула publish_id");
  }

  return publishId;
}

export async function publishToTikTok(input: TikTokPublishInput): Promise<TikTokPublishResult> {
  const creator = await queryCreatorInfo(input.accessToken);
  const privacyLevel = pickPrivacyLevel(creator.privacy_level_options);

  const publishId =
    input.mediaType === "video"
      ? await initPublish("/v2/post/publish/video/init/", input.accessToken, {
          post_info: {
            title: input.caption,
            privacy_level: privacyLevel,
            brand_content_toggle: false,
            brand_organic_toggle: true,
            is_aigc: true,
          },
          source_info: {
            source: "PULL_FROM_URL",
            video_url: input.mediaUrl,
          },
        })
      : await initPublish("/v2/post/publish/content/init/", input.accessToken, {
          post_info: {
            title: input.caption,
            description: input.caption,
            privacy_level: privacyLevel,
            brand_content_toggle: false,
            brand_organic_toggle: true,
          },
          source_info: {
            source: "PULL_FROM_URL",
            photo_cover_index: 0,
            photo_images: [input.mediaUrl],
          },
          post_mode: "DIRECT_POST",
          media_type: "PHOTO",
        });

  return {
    id: publishId,
    permalink: privacyLevel === "SELF_ONLY" ? null : "https://www.tiktok.com/",
  };
}
