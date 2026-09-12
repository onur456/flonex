import {
  SOCIAL_PLATFORMS,
  disconnectedAccount,
  type SocialAccount,
  type SocialPlatform,
} from "./social";

/**
 * Заглушка вместо таблицы `social_accounts` в Supabase. Состояние живёт в памяти
 * процесса, поэтому сбрасывается при перезапуске и не разделяется между
 * serverless-инстансами — этого достаточно, пока не подключён реальный OAuth.
 */
const accounts = new Map<SocialPlatform, SocialAccount>(
  SOCIAL_PLATFORMS.map((platform) => [platform.id, disconnectedAccount(platform.id)])
);

/** Имена, которые возвращает вместо реального OAuth-профиля. */
const MOCK_USERNAMES: Record<SocialPlatform, string> = {
  instagram: "@flonex.studio",
  facebook: "Flonex Store",
  tiktok: "@flonex",
};

export function listSocialAccounts(): SocialAccount[] {
  return SOCIAL_PLATFORMS.map(
    (platform) => accounts.get(platform.id) ?? disconnectedAccount(platform.id)
  );
}

export function connectSocialAccount(platform: SocialPlatform): SocialAccount {
  const account: SocialAccount = {
    platform,
    status: "connected",
    username: MOCK_USERNAMES[platform],
    avatarUrl: null,
    autoPublish: false,
    connectedAt: new Date().toISOString(),
  };

  accounts.set(platform, account);
  return account;
}

export function disconnectSocialAccount(platform: SocialPlatform): SocialAccount {
  const account = disconnectedAccount(platform);
  accounts.set(platform, account);
  return account;
}

export function setAutoPublish(
  platform: SocialPlatform,
  autoPublish: boolean
): SocialAccount | null {
  const current = accounts.get(platform);

  // Авто-публикацию нельзя включить для аккаунта, который ещё не подключён.
  if (!current || current.status !== "connected") {
    return null;
  }

  const account: SocialAccount = { ...current, autoPublish };
  accounts.set(platform, account);
  return account;
}
