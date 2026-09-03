import { NextResponse } from "next/server";
import {
  FAL_IMAGE_MODEL,
  FAL_IMAGE_TO_IMAGE_MODEL,
  FAL_VIDEO_MODEL,
  FalRequestError,
  extractImageUrl,
  extractVideoUrl,
  getFalKey,
  mapAspectRatioToImageSize,
  pickString,
  runFalModel,
} from "@/lib/fal";
import {
  saveGeneratedImageToStorage,
  saveGenerationRecord,
} from "@/lib/saveGeneratedImage";

function missingFalKeyResponse() {
  console.error("[Fal.ai] FAL_KEY is missing from environment variables");
  return NextResponse.json(
    { error: "API ключ FAL_KEY не найден в .env.local" },
    { status: 500 }
  );
}

function unexpectedErrorResponse(scope: string, error: unknown) {
  console.error(`[${scope}] Unexpected error:`, error);
  return NextResponse.json(
    {
      error:
        "Внутренняя ошибка сервера: " +
        (error instanceof Error ? error.message : ""),
    },
    { status: 500 }
  );
}

function falErrorResponse(scope: string, error: FalRequestError) {
  console.error(`[${scope}] Fal.ai error:`, error.message, error.payload);
  return NextResponse.json(
    { error: error.message },
    { status: error.status || 500 }
  );
}

export async function generateImageResponse(
  body: Record<string, unknown>
): Promise<NextResponse> {
  try {
    if (!getFalKey()) {
      return missingFalKeyResponse();
    }

    const prompt = pickString(body, "prompt");
    const imageUrl = pickString(body, "image_url", "imageUrl");
    const aspectRatio = pickString(body, "aspect_ratio", "aspectRatio");
    const style = pickString(body, "style") || "commercial";
    const productName = pickString(body, "productName", "product_name");
    const category = pickString(body, "category");

    if (!prompt && !imageUrl) {
      return NextResponse.json(
        { error: "prompt или image_url обязателен" },
        { status: 400 }
      );
    }

    const resolvedPrompt =
      prompt ||
      `Studio product placement, style: ${style}, professional studio lighting, 8k render, photorealistic`;

    const model = imageUrl ? FAL_IMAGE_TO_IMAGE_MODEL : FAL_IMAGE_MODEL;
    const promptWithRatio =
      aspectRatio && imageUrl
        ? `${resolvedPrompt}. Framed in ${aspectRatio} aspect ratio.`
        : resolvedPrompt;

    const input: Record<string, unknown> = {
      prompt: promptWithRatio,
      num_images: 1,
      output_format: "jpeg",
    };

    if (imageUrl) {
      input.image_url = imageUrl;
      input.strength = 0.8;
    } else {
      input.image_size = mapAspectRatioToImageSize(aspectRatio);
    }

    console.log("[generate-image] Calling Fal.ai", {
      model,
      hasImage: Boolean(imageUrl),
      aspectRatio: aspectRatio || "3:4",
    });

    const result = await runFalModel(model, input, {
      timeoutMs: 90_000,
      pollMs: 1_500,
    });

    const falImageUrl = extractImageUrl(result);

    if (!falImageUrl) {
      console.error("[generate-image] Fal.ai did not return image.url:", result);
      return NextResponse.json(
        { error: "Fal.ai не вернул изображение (image.url)" },
        { status: 500 }
      );
    }

    const storedUrl =
      (await saveGeneratedImageToStorage(falImageUrl)) || falImageUrl;

    const savedGeneration = await saveGenerationRecord({
      originalImageUrl: imageUrl || storedUrl,
      resultImageUrl: storedUrl,
      prompt: resolvedPrompt,
      style,
      productName,
      category,
    });

    return NextResponse.json({
      success: true,
      resultUrl: storedUrl,
      image: { url: storedUrl },
      generation: savedGeneration,
    });
  } catch (error) {
    if (error instanceof FalRequestError) {
      return falErrorResponse("generate-image", error);
    }
    return unexpectedErrorResponse("generate-image", error);
  }
}

export async function generateVideoResponse(
  body: Record<string, unknown>
): Promise<NextResponse> {
  try {
    if (!getFalKey()) {
      return missingFalKeyResponse();
    }

    const prompt = pickString(body, "prompt");
    const imageUrl = pickString(body, "image_url", "imageUrl");
    const style = pickString(body, "style") || "commercial";
    const productName = pickString(body, "productName", "product_name");
    const category = pickString(body, "category");

    if (!imageUrl) {
      return NextResponse.json(
        { error: "image_url обязателен для Motion Video Mode" },
        { status: 400 }
      );
    }

    const resolvedPrompt =
      prompt ||
      "Subtle cinematic product motion, professional lighting, the product stays clearly visible, smooth camera movement";

    console.log("[generate-video] Calling Fal.ai", {
      model: FAL_VIDEO_MODEL,
      hasImage: true,
    });

    const result = await runFalModel(
      FAL_VIDEO_MODEL,
      {
        prompt: resolvedPrompt,
        image_url: imageUrl,
        duration: "5",
      },
      {
        timeoutMs: 240_000,
        pollMs: 3_000,
      }
    );

    const falVideoUrl = extractVideoUrl(result);

    if (!falVideoUrl) {
      console.error("[generate-video] Fal.ai did not return video.url:", result);
      return NextResponse.json(
        { error: "Fal.ai не вернул видео (video.url)" },
        { status: 500 }
      );
    }

    const storedUrl =
      (await saveGeneratedImageToStorage(falVideoUrl)) || falVideoUrl;

    const savedGeneration = await saveGenerationRecord({
      originalImageUrl: imageUrl,
      resultImageUrl: storedUrl,
      prompt: resolvedPrompt,
      style,
      productName,
      category,
    });

    return NextResponse.json({
      success: true,
      resultUrl: storedUrl,
      video: { url: storedUrl },
      generation: savedGeneration,
    });
  } catch (error) {
    if (error instanceof FalRequestError) {
      return falErrorResponse("generate-video", error);
    }
    return unexpectedErrorResponse("generate-video", error);
  }
}
