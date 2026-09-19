import { createClient } from "@supabase/supabase-js";
import {
  formatSupabaseError,
  supabaseAnonKey,
  supabaseUrl,
} from "./supabaseConfig";

const BUCKET = "3d-models";

function getSupabase() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

/** Скачивает GLB с Fal.ai и кладёт в публичный bucket `3d-models`. */
export async function saveGlbToStorage(modelUrl: string): Promise<string | null> {
  try {
    const response = await fetch(modelUrl);
    if (!response.ok) {
      console.error("Failed to download generated GLB:", response.status);
      return null;
    }

    const contentType = response.headers.get("content-type") || "model/gltf-binary";
    const fileName = `model-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.glb`;
    const buffer = await response.arrayBuffer();

    const supabase = getSupabase();
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(fileName, buffer, {
      contentType,
      cacheControl: "31536000",
      upsert: false,
    });

    if (uploadError) {
      console.error("3d-models upload error:", formatSupabaseError(uploadError));
      return null;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
  } catch (error) {
    console.error("saveGlbToStorage error:", formatSupabaseError(error));
    return null;
  }
}

export interface SavedGeneratedModel {
  id: string;
  source_image_url: string;
  model_url: string;
  product_name: string | null;
  created_at: string;
}

export async function saveGeneratedModelRecord(input: {
  sourceImageUrl: string;
  modelUrl: string;
  productName?: string;
}): Promise<SavedGeneratedModel | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("generated_models")
    .insert([
      {
        source_image_url: input.sourceImageUrl,
        model_url: input.modelUrl,
        product_name: input.productName || null,
      },
    ])
    .select("*")
    .single();

  if (error) {
    console.error("generated_models insert error:", formatSupabaseError(error));
    return null;
  }

  return data as SavedGeneratedModel;
}
