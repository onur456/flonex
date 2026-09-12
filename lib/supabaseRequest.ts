import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./supabaseConfig";

export interface RequestAuth {
  /** Клиент, работающий от имени пользователя — доступ к строкам ограничивает RLS. */
  client: SupabaseClient;
  userId: string;
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) return null;

  return token.trim();
}

/**
 * Определяет пользователя по access-токену из заголовка `Authorization`.
 * Сессия в этом проекте живёт в localStorage браузера, поэтому серверу её
 * передаёт сам клиент — cookie-сессий (`@supabase/ssr`) здесь нет.
 */
export async function getRequestAuth(request: Request): Promise<RequestAuth | null> {
  if (!isSupabaseConfigured) return null;

  const token = readBearerToken(request);
  if (!token) return null;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) return null;

  return { client, userId: data.user.id };
}
