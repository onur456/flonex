import { supabase } from "./supabase";

export async function uploadProductImage(file: File): Promise<string | null> {
  try {
    // Получаем чистое расширение (jpg, png и т.д.)
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    
    // Генерируем безопасное уникальное имя файла без кириллицы и пробелов
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

    // Загружаем файл напрямую в корень бакета 'products'
    const { data, error: uploadError } = await supabase.storage
      .from("products")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      alert(`Ошибка Supabase Storage: ${uploadError.message}`);
      return null;
    }

    // Получаем публичную прямую ссылку
    const { data: publicUrlData } = supabase.storage
      .from("products")
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (err: any) {
    console.error("Upload error:", err);
    alert(`Общая ошибка загрузки: ${err?.message || JSON.stringify(err)}`);
    return null;
  }
}