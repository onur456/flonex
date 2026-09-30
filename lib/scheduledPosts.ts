import type { SocialMediaType } from "./social";
import type { PlannerPlatform } from "./planner";
import { supabase } from "./supabase";
import { formatSupabaseError, isSupabaseConfigured } from "./supabaseConfig";

export type ScheduledPostStatus = "scheduled" | "queued" | "published" | "failed";

export interface ScheduledPost {
  id: string;
  mediaUrl: string;
  mediaType: SocialMediaType;
  platform: PlannerPlatform;
  accountLabel: string | null;
  caption: string;
  scheduledAt: string;
  status: ScheduledPostStatus;
  productTitle: string | null;
  productDescription: string | null;
  productPrice: string | null;
  model3dUrl: string | null;
  createdAt: string;
}

const LOCAL_KEY = "flonex-scheduled-posts";

function readLocal(): ScheduledPost[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScheduledPost[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(posts: ScheduledPost[]) {
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(posts));
}

function fromRow(row: Record<string, unknown>): ScheduledPost {
  return {
    id: String(row.id),
    mediaUrl: String(row.media_url),
    mediaType: row.media_type === "video" ? "video" : "image",
    platform: row.platform as PlannerPlatform,
    accountLabel: typeof row.account_label === "string" ? row.account_label : null,
    caption: typeof row.caption === "string" ? row.caption : "",
    scheduledAt: String(row.scheduled_at),
    status: (row.status as ScheduledPostStatus) || "scheduled",
    productTitle: typeof row.product_title === "string" ? row.product_title : null,
    productDescription:
      typeof row.product_description === "string" ? row.product_description : null,
    productPrice: typeof row.product_price === "string" ? row.product_price : null,
    model3dUrl: typeof row.model_3d_url === "string" ? row.model_3d_url : null,
    createdAt: String(row.created_at),
  };
}

export async function fetchScheduledPosts(userId: string | null): Promise<ScheduledPost[]> {
  if (!userId || !isSupabaseConfigured) {
    return readLocal().sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
  }

  const { data, error } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("user_id", userId)
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error("scheduled_posts fetch error:", formatSupabaseError(error));
    return readLocal();
  }

  return (data ?? []).map((row) => fromRow(row as Record<string, unknown>));
}

export async function insertScheduledPost(input: {
  userId: string | null;
  mediaUrl: string;
  mediaType: SocialMediaType;
  platform: PlannerPlatform;
  accountLabel?: string | null;
  caption: string;
  scheduledAt: string;
  status: ScheduledPostStatus;
  productTitle?: string | null;
  productDescription?: string | null;
  productPrice?: string | null;
  model3dUrl?: string | null;
}): Promise<ScheduledPost> {
  const localPost: ScheduledPost = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `local-${Date.now()}`,
    mediaUrl: input.mediaUrl,
    mediaType: input.mediaType,
    platform: input.platform,
    accountLabel: input.accountLabel ?? null,
    caption: input.caption,
    scheduledAt: input.scheduledAt,
    status: input.status,
    productTitle: input.productTitle ?? null,
    productDescription: input.productDescription ?? null,
    productPrice: input.productPrice ?? null,
    model3dUrl: input.model3dUrl ?? null,
    createdAt: new Date().toISOString(),
  };

  if (!input.userId || !isSupabaseConfigured) {
    writeLocal([...readLocal(), localPost]);
    return localPost;
  }

  const { data, error } = await supabase
    .from("scheduled_posts")
    .insert([
      {
        user_id: input.userId,
        media_url: input.mediaUrl,
        media_type: input.mediaType,
        platform: input.platform,
        account_label: input.accountLabel || null,
        caption: input.caption,
        scheduled_at: input.scheduledAt,
        status: input.status,
        product_title: input.productTitle || null,
        product_description: input.productDescription || null,
        product_price: input.productPrice || null,
        model_3d_url: input.model3dUrl || null,
      },
    ])
    .select("*")
    .single();

  if (error) {
    console.error("scheduled_posts insert error:", formatSupabaseError(error));
    writeLocal([...readLocal(), localPost]);
    return localPost;
  }

  return fromRow(data as Record<string, unknown>);
}
