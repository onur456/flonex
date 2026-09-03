export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseHost = (() => {
  try {
    return new URL(supabaseUrl).host;
  } catch {
    return "";
  }
})();

const NETWORK_FAILURE_MARKERS = [
  "failed to fetch",
  "fetcherror",
  "networkerror",
  "network request failed",
  "load failed",
  "enotfound",
  "err_name_not_resolved",
];

/**
 * Supabase reports errors in several shapes: plain `{ message, details, hint, code }`
 * objects from postgrest, and `Error` subclasses from storage/auth whose `message` is
 * non-enumerable and therefore logs as `{}`. Flatten all of them into one readable string.
 */
export function formatSupabaseError(error: unknown): string {
  if (!error) return "Unknown error";

  const parts: string[] = [];

  if (typeof error === "string") {
    parts.push(error);
  } else if (error instanceof Error) {
    parts.push(`${error.name}: ${error.message}`);
  } else if (typeof error === "object") {
    const { message, details, hint, code } = error as Record<string, unknown>;
    if (message) parts.push(String(message));
    if (code) parts.push(`code=${String(code)}`);
    if (hint) parts.push(`hint=${String(hint)}`);
    if (details) {
      const firstLine = String(details).split("\n")[0].trim();
      if (firstLine && firstLine !== String(message ?? "").trim()) {
        parts.push(`details=${firstLine}`);
      }
    }
  }

  let summary = parts.length > 0 ? parts.join(" | ") : JSON.stringify(error);

  if (!isSupabaseConfigured) {
    return `${summary} - Supabase env vars are missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).`;
  }

  const isNetworkFailure = NETWORK_FAILURE_MARKERS.some((marker) =>
    summary.toLowerCase().includes(marker)
  );

  if (isNetworkFailure) {
    summary += ` - could not reach ${
      supabaseHost || "the Supabase URL"
    }. Verify the project still exists and is not paused, and that NEXT_PUBLIC_SUPABASE_URL is correct.`;
  }

  return summary;
}
