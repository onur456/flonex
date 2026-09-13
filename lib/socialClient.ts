import type {
  PublishPayload,
  PublishResponse,
  SocialAccount,
  SocialPlatform,
} from "./social";
import { supabase } from "./supabase";

export class SocialApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SocialApiError";
    this.status = status;
  }
}

export function isAuthError(error: unknown): boolean {
  return error instanceof SocialApiError && error.status === 401;
}

/**
 * Все запросы к `/api/social/*` идут с access-токеном текущей сессии: сервер по
 * нему определяет пользователя, а доступ к строкам ограничивает RLS.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new SocialApiError("Войдите в аккаунт, чтобы управлять подключениями", 401);
  }

  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };

  if (!res.ok) {
    throw new SocialApiError(data.error || `Status ${res.status}`, res.status);
  }

  return data;
}

export function fetchAccounts(): Promise<{ accounts: SocialAccount[] }> {
  return request("/api/social/accounts");
}

/** Только TikTok: Instagram и Facebook подключаются через `startMetaOAuth`. */
export function connectAccount(platform: SocialPlatform): Promise<{ account: SocialAccount }> {
  return request("/api/social/accounts", {
    method: "POST",
    body: JSON.stringify({ platform }),
  });
}

/**
 * Ссылка на диалог входа Meta. Её нужно получить запросом с токеном: сервер
 * зашивает id пользователя в подписанный `state`, чтобы узнать его на callback.
 */
export function startMetaOAuth(): Promise<{ url: string; redirectUri: string }> {
  return request("/api/social/oauth/meta/start", { method: "POST" });
}

export function updateAutoPublish(
  platform: SocialPlatform,
  autoPublish: boolean
): Promise<{ account: SocialAccount }> {
  return request("/api/social/accounts", {
    method: "PATCH",
    body: JSON.stringify({ platform, autoPublish }),
  });
}

export function disconnectAccount(platform: SocialPlatform): Promise<{ platform: string }> {
  return request(`/api/social/accounts?platform=${platform}`, { method: "DELETE" });
}

export function publishAsset(payload: PublishPayload): Promise<PublishResponse> {
  return request("/api/social/publish", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Генерация подписи не трогает данные пользователя, поэтому идёт без токена. */
export async function enhanceCaption(input: {
  caption: string;
  productName?: string;
  platforms: SocialPlatform[];
}): Promise<string> {
  const res = await fetch("/api/social/caption", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = (await res.json().catch(() => ({}))) as { caption?: string; error?: string };

  if (!res.ok || !data.caption) {
    throw new SocialApiError(data.error || `Status ${res.status}`, res.status);
  }

  return data.caption;
}
