import { NextResponse } from "next/server";
import {
  FAL_3D_MODEL,
  FalRequestError,
  asJsonRecord,
  extractModelUrl,
  getFalKey,
  pickString,
  runFalModel,
} from "@/lib/fal";
import { saveGlbToStorage } from "@/lib/save3dModel";

export const runtime = "nodejs";
export const maxDuration = 120;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Image → 3D через Fal.ai TripoSR. GLB сразу кладём в `3d-models`, чтобы
 * просмотрщик не зависел от короткоживущих ссылок Fal.
 */
export async function POST(request: Request) {
  try {
    if (!getFalKey()) {
      return NextResponse.json(
        { error: "API ключ FAL_KEY не найден в .env.local" },
        { status: 500 }
      );
    }

    const body = asJsonRecord(await request.json().catch(() => ({})));
    const imageUrl = pickString(body, "imageUrl", "image_url");

    if (!imageUrl || !isHttpUrl(imageUrl)) {
      return NextResponse.json(
        { error: "imageUrl должен быть http(s)-ссылкой на фото товара" },
        { status: 400 }
      );
    }

    console.log("[generate-3d] Calling Fal.ai", { model: FAL_3D_MODEL });

    const result = await runFalModel(
      FAL_3D_MODEL,
      {
        image_url: imageUrl,
        output_format: "glb",
        do_remove_background: true,
        foreground_ratio: 0.9,
        mc_resolution: 256,
      },
      { timeoutMs: 90_000, pollMs: 1_500 }
    );

    const falModelUrl = extractModelUrl(result);

    if (!falModelUrl) {
      console.error("[generate-3d] Fal.ai did not return model_mesh.url:", result);
      return NextResponse.json(
        { error: "Fal.ai не вернул 3D-модель (model_mesh.url)" },
        { status: 500 }
      );
    }

    const storedUrl = (await saveGlbToStorage(falModelUrl)) || falModelUrl;

    return NextResponse.json({
      success: true,
      modelUrl: storedUrl,
      sourceImageUrl: imageUrl,
    });
  } catch (error) {
    if (error instanceof FalRequestError) {
      console.error("[generate-3d] Fal.ai error:", error.message, error.payload);
      return NextResponse.json(
        { error: error.message },
        { status: error.status || 500 }
      );
    }

    console.error("[generate-3d] Unexpected error:", error);
    return NextResponse.json(
      {
        error:
          "Внутренняя ошибка сервера: " +
          (error instanceof Error ? error.message : ""),
      },
      { status: 500 }
    );
  }
}
