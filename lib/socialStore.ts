import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetaPage } from "./meta";
import {
  SOCIAL_PLATFORMS,
  disconnectedAccount,
  isSocialPlatform,
  type SocialAccount,
  type SocialPlatform,
} from "./social";
import { formatSupabaseError } from "./supabaseConfig";

const TABLE = "social_accounts";

/** Токены платформ: доступны только service_role, у таблицы нет RLS-политик. */
const SECRETS_TABLE = "social_account_secrets";

interface SocialAccountRow {
  platform: string;
  username: string | null;
  avatar_url: string | null;
  auto_publish: boolean;
  connected_at: string;
}

/**
 * Профиль, который вернул бы OAuth платформы. Instagram и Facebook подключаются
 * настоящим Meta OAuth, так что заглушка осталась только для TikTok — до
 * подключения TikTok Login Kit.
 */
const MOCK_USERNAMES: Record<SocialPlatform, string> = {
  instagram: "@flonex.studio",
  facebook: "Flonex Store",
  tiktok: "@flonex",
};

function toAccount(row: SocialAccountRow): SocialAccount {
  return {
    platform: row.platform as SocialPlatform,
    status: "connected",
    username: row.username,
    avatarUrl: row.avatar_url,
    autoPublish: row.auto_publish,
    connectedAt: row.connected_at,
  };
}

const ROW_COLUMNS = "platform, username, avatar_url, auto_publish, connected_at";

/** Возвращает все платформы: у неподключённых — заготовка со статусом disconnected. */
export async function listSocialAccounts(
  client: SupabaseClient,
  userId: string
): Promise<SocialAccount[]> {
  const { data, error } = await client
    .from(TABLE)
    .select(ROW_COLUMNS)
    .eq("user_id", userId);

  if (error) {
    throw new Error(formatSupabaseError(error));
  }

  const connected = new Map<string, SocialAccount>(
    (data ?? []).map((row) => [row.platform, toAccount(row as SocialAccountRow)])
  );

  return SOCIAL_PLATFORMS.map(
    (platform) => connected.get(platform.id) ?? disconnectedAccount(platform.id)
  );
}

export async function connectSocialAccount(
  client: SupabaseClient,
  userId: string,
  platform: SocialPlatform
): Promise<SocialAccount> {
  // auto_publish намеренно не передаём: при повторном подключении настройка
  // пользователя должна сохраниться, а у новой строки сработает default false.
  const { data, error } = await client
    .from(TABLE)
    .upsert(
      {
        user_id: userId,
        platform,
        username: MOCK_USERNAMES[platform],
        avatar_url: null,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" }
    )
    .select(ROW_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(formatSupabaseError(error ?? "Не удалось подключить аккаунт"));
  }

  return toAccount(data as SocialAccountRow);
}

interface MetaAccountRow {
  user_id: string;
  platform: SocialPlatform;
  username: string | null;
  avatar_url: string | null;
  platform_account_id: string;
  page_id: string;
  connected_at: string;
}

/**
 * Записывает результат Meta OAuth. Вызывается из callback-а, где токена
 * пользователя нет, поэтому клиент обязан быть service-role: RLS не пропустит
 * запись от чужого имени, а таблицу с токенами пользователь не видит вовсе.
 *
 * Возвращает платформы, которые удалось подключить: Instagram появляется только
 * если к странице привязан профессиональный аккаунт.
 */
export async function saveMetaConnection(
  admin: SupabaseClient,
  userId: string,
  page: MetaPage
): Promise<SocialPlatform[]> {
  const connectedAt = new Date().toISOString();

  const rows: MetaAccountRow[] = [
    {
      user_id: userId,
      platform: "facebook",
      username: page.name,
      avatar_url: null,
      platform_account_id: page.id,
      page_id: page.id,
      connected_at: connectedAt,
    },
  ];

  if (page.instagram) {
    rows.push({
      user_id: userId,
      platform: "instagram",
      username: page.instagram.username,
      avatar_url: page.instagram.avatarUrl,
      platform_account_id: page.instagram.id,
      page_id: page.id,
      connected_at: connectedAt,
    });
  }

  // auto_publish намеренно не передаём: при переподключении выбор пользователя
  // должен сохраниться, а у новой строки сработает default false.
  const { error } = await admin
    .from(TABLE)
    .upsert(rows, { onConflict: "user_id,platform" });

  if (error) {
    throw new Error(formatSupabaseError(error));
  }

  // Токеном страницы публикуются и посты страницы, и Instagram.
  const { error: secretsError } = await admin.from(SECRETS_TABLE).upsert(
    rows.map((row) => ({
      user_id: userId,
      platform: row.platform,
      access_token: page.accessToken,
      updated_at: connectedAt,
    })),
    { onConflict: "user_id,platform" }
  );

  if (secretsError) {
    throw new Error(formatSupabaseError(secretsError));
  }

  return rows.map((row) => row.platform);
}

export interface PublishTarget {
  /** id объекта публикации: страница Facebook или аккаунт Instagram. */
  accountId: string | null;
  accessToken: string | null;
}

/**
 * Всё, что нужно для публикации, по подключённым платформам. Токены лежат в
 * закрытой таблице, поэтому клиент здесь тоже обязан быть service-role.
 */
export async function getPublishTargets(
  admin: SupabaseClient,
  userId: string
): Promise<Map<SocialPlatform, PublishTarget>> {
  const [accounts, secrets] = await Promise.all([
    admin
      .from(TABLE)
      .select("platform, platform_account_id")
      .eq("user_id", userId),
    admin.from(SECRETS_TABLE).select("platform, access_token").eq("user_id", userId),
  ]);

  if (accounts.error) {
    throw new Error(formatSupabaseError(accounts.error));
  }

  if (secrets.error) {
    throw new Error(formatSupabaseError(secrets.error));
  }

  const tokens = new Map<string, string>(
    (secrets.data ?? []).map((row) => [row.platform as string, row.access_token as string])
  );

  const targets = new Map<SocialPlatform, PublishTarget>();

  for (const row of accounts.data ?? []) {
    const platform = row.platform as unknown;
    if (!isSocialPlatform(platform)) continue;

    targets.set(platform, {
      accountId: (row.platform_account_id as string | null) ?? null,
      accessToken: tokens.get(platform) ?? null,
    });
  }

  return targets;
}

export async function disconnectSocialAccount(
  client: SupabaseClient,
  userId: string,
  platform: SocialPlatform
): Promise<void> {
  const { error } = await client
    .from(TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("platform", platform);

  if (error) {
    throw new Error(formatSupabaseError(error));
  }
}

/** `null`, если аккаунт ещё не подключён — включать авто-публикацию нечему. */
export async function setAutoPublish(
  client: SupabaseClient,
  userId: string,
  platform: SocialPlatform,
  autoPublish: boolean
): Promise<SocialAccount | null> {
  const { data, error } = await client
    .from(TABLE)
    .update({ auto_publish: autoPublish })
    .eq("user_id", userId)
    .eq("platform", platform)
    .select(ROW_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(formatSupabaseError(error));
  }

  return data ? toAccount(data as SocialAccountRow) : null;
}
