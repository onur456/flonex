import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { metaClientSecret } from "./meta";

/**
 * Meta возвращает пользователя на callback обычным переходом браузера, без
 * заголовка `Authorization`, а сессия в этом проекте живёт в localStorage —
 * значит по самому запросу понять, кто вернулся, невозможно.
 *
 * Поэтому id пользователя едет в параметре `state`, подписанном HMAC на
 * серверном секрете. Подделать такой state нельзя, а короткий срок жизни не
 * даёт переиспользовать перехваченную ссылку. Заодно state выполняет свою
 * штатную роль — защиту от CSRF.
 */
const STATE_TTL_MS = 10 * 60 * 1000;

/** Метка отделяет этот ключ от других применений того же секрета. */
const SIGNING_KEY_LABEL = "flonex:oauth-state:v1";

interface StatePayload {
  u: string;
  e: number;
  n: string;
}

function signingSecret(): string {
  const secret = metaClientSecret || process.env.TIKTOK_CLIENT_SECRET?.trim() || "";
  if (!secret) {
    throw new Error("Для подписи OAuth state нужен META_CLIENT_SECRET или TIKTOK_CLIENT_SECRET");
  }

  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", `${SIGNING_KEY_LABEL}:${signingSecret()}`)
    .update(payload)
    .digest("base64url");
}

export function createOAuthState(userId: string): string {
  const payload: StatePayload = {
    u: userId,
    e: Date.now() + STATE_TTL_MS,
    n: randomBytes(8).toString("hex"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${encoded}.${sign(encoded)}`;
}

/** `null` для любого некорректного, подделанного или просроченного state. */
export function verifyOAuthState(state: string | null): string | null {
  if (!state) return null;

  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;

  let expected: Buffer;
  try {
    expected = Buffer.from(sign(encoded));
  } catch {
    return null;
  }

  const received = Buffer.from(signature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString()
    ) as StatePayload;

    if (typeof payload.u !== "string" || typeof payload.e !== "number") return null;
    if (Date.now() > payload.e) return null;

    return payload.u;
  } catch {
    return null;
  }
}
