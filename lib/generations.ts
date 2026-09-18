import type { SocialMediaType } from "./social";
import { supabase } from "./supabase";
import { formatSupabaseError, isSupabaseConfigured } from "./supabaseConfig";

export interface GenerationAsset {
  id: string;
  url: string;
  type: SocialMediaType;
  productName: string | null;
  createdAt: string;
}

export function isVideoMediaUrl(url: string): boolean {
  const clean = url.split("?")[0].toLowerCase();
  return clean.endsWith(".mp4") || clean.endsWith(".webm") || clean.endsWith(".mov");
}

export function mediaTypeFromUrl(url: string): SocialMediaType {
  return isVideoMediaUrl(url) ? "video" : "image";
}

/** История генераций пользователя: фото и Kling-видео из таблицы `generations`. */
export async function fetchGenerationAssets(limit = 24): Promise<GenerationAsset[]> {
  if (!isSupabaseConfigured) {
    throw new Error(formatSupabaseError("Cannot load generations"));
  }

  const { data, error } = await supabase
    .from("generations")
    .select("id, result_image_url, created_at, product_name")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(formatSupabaseError(error));
  }

  return (data ?? [])
    .filter((row): row is typeof row & { result_image_url: string } =>
      Boolean(row.result_image_url)
    )
    .map((row) => ({
      id: String(row.id),
      url: row.result_image_url,
      type: mediaTypeFromUrl(row.result_image_url),
      productName: (row.product_name as string | null) ?? null,
      createdAt: String(row.created_at),
    }));
}
