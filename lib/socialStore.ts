import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SOCIAL_PLATFORMS,
  disconnectedAccount,
  type SocialAccount,
  type SocialPlatform,
} from "./social";
import { formatSupabaseError } from "./supabaseConfig";

const TABLE = "social_accounts";

interface SocialAccountRow {
  platform: string;
  username: string | null;
  avatar_url: string | null;
  auto_publish: boolean;
  connected_at: string;
}

/**
 * Профиль, который вернул бы OAuth платформы. Остаётся заглушкой до подключения
 * реального Meta Login / TikTok Login Kit — в базу уже пишутся настоящие строки.
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
