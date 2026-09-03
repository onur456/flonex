import { formatSupabaseError, isSupabaseConfigured, supabase } from "./supabase";

export async function uploadProductImage(file: File): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart the dev server."
    );
  }

  // Безопасное уникальное имя файла без кириллицы и пробелов
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("products")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    throw new Error(`Supabase Storage upload failed: ${formatSupabaseError(uploadError)}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from("products")
    .getPublicUrl(fileName);

  if (!publicUrlData?.publicUrl) {
    throw new Error(
      `Supabase Storage did not return a public URL for "${fileName}". Make sure the "products" bucket is public.`
    );
  }

  return publicUrlData.publicUrl;
}
