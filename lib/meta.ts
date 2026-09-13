import type { SocialMediaType } from "./social";

/**
 * Meta Graph API: один вход через Facebook Login for Business даёт и страницы
 * Facebook, и привязанные к ним профессиональные аккаунты Instagram. В Instagram
 * публикуем токеном связанной страницы — это вариант «Instagram API with
 * Facebook Login», поэтому отдельный вход в Instagram не нужен.
 *
 * Версия зафиксирована осознанно: Meta ломает совместимость между версиями и
 * выключает старые примерно через два года, так что апгрейд — отдельная задача.
 */
export const GRAPH_VERSION = "v26.0";

const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const metaClientId = process.env.META_CLIENT_ID?.trim() || "";
export const metaClientSecret = process.env.META_CLIENT_SECRET?.trim() || "";
export const isMetaConfigured = Boolean(metaClientId && metaClientSecret);

/**
 * `publish_video` нужен только для видео на страницу Facebook. Если приложение
 * его не получило, диалог входа вернёт ошибку — тогда достаточно убрать строку,
 * фото и Instagram продолжат работать.
 */
export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "publish_video",
  "instagram_basic",
  "instagram_content_publish",
];

/** Путь callback-а. Ровно этот адрес должен быть в Valid OAuth Redirect URIs. */
export const META_CALLBACK_PATH = "/api/social/oauth/meta/callback";

/**
 * `NEXT_PUBLIC_APP_URL` важнее origin запроса: за прокси Vercel origin может
 * оказаться внутренним и не совпасть с белым списком Meta.
 */
export function appOrigin(requestUrl: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");

  return configured || new URL(requestUrl).origin;
}

/**
 * Meta сверяет `redirect_uri` посимвольно и на диалоге входа, и при обмене
 * `code` на токен, поэтому адрес всегда считается этой функцией.
 */
export function metaRedirectUri(requestUrl: string): string {
  return `${appOrigin(requestUrl)}${META_CALLBACK_PATH}`;
}

interface GraphErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_user_msg?: string;
  };
}

/** Meta кладёт ошибку в тело даже при 400, и текст там куда полезнее статуса. */
function graphError(status: number, body: unknown): Error {
  const error = (body as GraphErrorBody | null)?.error;
  const message =
    error?.error_user_msg || error?.message || `Graph API ответил ${status}`;

  return new Error(error?.code ? `${message} (code ${error.code})` : message);
}

async function graphFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw graphError(res.status, body);
  }

  return body as T;
}

function graphPost<T>(path: string, params: Record<string, string>): Promise<T> {
  return graphFetch<T>(`${GRAPH_URL}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
}

export function buildMetaAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: metaClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: META_SCOPES.join(","),
    state,
  });

  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<string> {
  const params = new URLSearchParams({
    client_id: metaClientId,
    client_secret: metaClientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const data = await graphFetch<TokenResponse>(
    `${GRAPH_URL}/oauth/access_token?${params.toString()}`
  );

  return data.access_token;
}

/**
 * Токен из `code` живёт около часа. Долгий пользовательский токен (~60 дней)
 * нужен, чтобы полученные из него токены страниц не истекали.
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: metaClientId,
    client_secret: metaClientSecret,
    fb_exchange_token: shortLivedToken,
  });

  const data = await graphFetch<TokenResponse>(
    `${GRAPH_URL}/oauth/access_token?${params.toString()}`
  );

  return data.access_token;
}

export interface MetaInstagramAccount {
  id: string;
  username: string | null;
  avatarUrl: string | null;
}

export interface MetaPage {
  id: string;
  name: string;
  /** Токен страницы: именно им публикуются и посты страницы, и Instagram. */
  accessToken: string;
  instagram: MetaInstagramAccount | null;
}

interface RawPage {
  id?: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: {
    id?: string;
    username?: string;
    profile_picture_url?: string;
  };
}

export async function listManagedPages(userToken: string): Promise<MetaPage[]> {
  const params = new URLSearchParams({
    fields:
      "id,name,access_token,instagram_business_account{id,username,profile_picture_url}",
    limit: "100",
    access_token: userToken,
  });

  const data = await graphFetch<{ data?: RawPage[] }>(
    `${GRAPH_URL}/me/accounts?${params.toString()}`
  );

  return (data.data ?? [])
    .filter((page): page is RawPage & { id: string; access_token: string } =>
      Boolean(page.id && page.access_token)
    )
    .map((page) => {
      const instagram = page.instagram_business_account;

      return {
        id: page.id,
        name: page.name?.trim() || page.id,
        accessToken: page.access_token,
        instagram: instagram?.id
          ? {
              id: instagram.id,
              username: instagram.username ? `@${instagram.username}` : null,
              avatarUrl: instagram.profile_picture_url ?? null,
            }
          : null,
      };
    });
}

export interface PublishInput {
  accountId: string;
  accessToken: string;
  mediaUrl: string;
  mediaType: SocialMediaType;
  caption: string;
  /** `null` — публикуем сразу. */
  scheduledAt: Date | null;
}

export interface PublishResult {
  id: string;
  permalink: string | null;
}

/** Facebook принимает отложенную публикацию только в этом окне. */
export const FACEBOOK_SCHEDULE_MIN_MS = 10 * 60 * 1000;
export const FACEBOOK_SCHEDULE_MAX_MS = 30 * 24 * 60 * 60 * 1000;

function scheduleParams(scheduledAt: Date): Record<string, string> {
  return {
    published: "false",
    unpublished_content_type: "SCHEDULED",
    scheduled_publish_time: String(Math.floor(scheduledAt.getTime() / 1000)),
  };
}

/** Permalink — приятный бонус, поэтому его отсутствие не роняет публикацию. */
async function fetchPermalink(
  objectId: string,
  accessToken: string,
  field: "permalink" | "permalink_url"
): Promise<string | null> {
  try {
    const params = new URLSearchParams({ fields: field, access_token: accessToken });
    const data = await graphFetch<Record<string, string>>(
      `${GRAPH_URL}/${objectId}?${params.toString()}`
    );
    const value = data[field];

    if (!value) return null;

    return value.startsWith("/") ? `https://www.facebook.com${value}` : value;
  } catch {
    return null;
  }
}

export async function publishToFacebookPage(
  input: PublishInput
): Promise<PublishResult> {
  const { accountId, accessToken, mediaUrl, mediaType, caption, scheduledAt } = input;

  const isVideo = mediaType === "video";
  const params: Record<string, string> = {
    access_token: accessToken,
    ...(isVideo
      ? { file_url: mediaUrl, description: caption }
      : { url: mediaUrl, message: caption }),
    ...(scheduledAt ? scheduleParams(scheduledAt) : {}),
  };

  const created = await graphPost<{ id?: string; post_id?: string }>(
    `${accountId}/${isVideo ? "videos" : "photos"}`,
    params
  );

  const postId = created.post_id || created.id;

  if (!postId) {
    throw new Error("Facebook не вернул id поста");
  }

  return {
    id: postId,
    // У отложенного поста ссылки ещё нет — он не опубликован.
    permalink: scheduledAt
      ? null
      : await fetchPermalink(postId, accessToken, "permalink_url"),
  };
}

type ContainerStatus = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";

/**
 * Видео Instagram обрабатывает асинхронно: публиковать контейнер можно только
 * после `FINISHED`. Держимся в пределах таймаута serverless-функции, поэтому
 * ждём меньше рекомендованных Meta пяти минут.
 */
async function waitForContainer(
  containerId: string,
  accessToken: string,
  timeoutMs = 40_000
): Promise<void> {
  const params = new URLSearchParams({
    fields: "status_code",
    access_token: accessToken,
  });
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const data = await graphFetch<{ status_code?: ContainerStatus }>(
      `${GRAPH_URL}/${containerId}?${params.toString()}`
    );
    const status = data.status_code;

    if (status === "FINISHED" || status === "PUBLISHED") return;

    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`Instagram не смог обработать видео (${status})`);
    }

    if (Date.now() >= deadline) {
      throw new Error(
        "Instagram всё ещё обрабатывает видео — попробуйте опубликовать снова через минуту"
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

/**
 * Публикация в Instagram двухшаговая: контейнер, затем `media_publish`.
 * Отложенной публикации в API нет вовсе — вызов всегда постит сразу.
 */
export async function publishToInstagram(input: PublishInput): Promise<PublishResult> {
  const { accountId, accessToken, mediaUrl, mediaType, caption } = input;
  const isVideo = mediaType === "video";

  const container = await graphPost<{ id?: string }>(`${accountId}/media`, {
    access_token: accessToken,
    caption,
    ...(isVideo
      ? { media_type: "REELS", video_url: mediaUrl }
      : { image_url: mediaUrl }),
  });

  if (!container.id) {
    throw new Error("Instagram не вернул id контейнера");
  }

  if (isVideo) {
    await waitForContainer(container.id, accessToken);
  }

  const published = await graphPost<{ id?: string }>(`${accountId}/media_publish`, {
    creation_id: container.id,
    access_token: accessToken,
  });

  if (!published.id) {
    throw new Error("Instagram не вернул id публикации");
  }

  return {
    id: published.id,
    permalink: await fetchPermalink(published.id, accessToken, "permalink"),
  };
}
