import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getSupabase(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function saveGeneratedImageToStorage(
  imageUrl: string
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error("Failed to download generated image:", response.status);
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const ext = contentType.includes("jpeg") ? "jpg" : "png";
    const fileName = `generated-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
    const imageBuffer = await response.arrayBuffer();

    const supabase = getSupabase();
    const { error: uploadError } = await supabase.storage
      .from("generations")
      .upload(fileName, imageBuffer, {
        contentType,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from("generations")
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error("saveGeneratedImageToStorage error:", err);
    return null;
  }
}

export interface SavedGeneration {
  id: string;
  original_image_url: string;
  result_image_url: string;
  prompt: string | null;
  style: string | null;
  created_at: string;
}

export async function saveGenerationRecord(data: {
  originalImageUrl: string;
  resultImageUrl: string;
  prompt: string;
  style: string;
  productName?: string;
  category?: string;
}): Promise<SavedGeneration | null> {
  const supabase = getSupabase();

  const { data: record, error } = await supabase
    .from("generations")
    .insert([
      {
        original_image_url: data.originalImageUrl,
        result_image_url: data.resultImageUrl,
        prompt: data.prompt,
        style: data.style,
        product_name: data.productName || null,
        category: data.category || null,
      },
    ])
    .select("*")
    .single();

  if (error) {
    console.error("generations insert error:", error);
    return null;
  }

  return record as SavedGeneration;
}
