import { NextResponse } from "next/server";
import {
  saveGeneratedImageToStorage,
  saveGenerationRecord,
} from "@/lib/saveGeneratedImage";

export async function POST(request: Request) {
  try {
    const { imageUrl, prompt, style, productName, category } =
      await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Ссылка на изображение обязательна" },
        { status: 400 }
      );
    }

    const falApiKey = process.env.FAL_KEY;
    if (!falApiKey) {
      return NextResponse.json(
        { error: "API ключ FAL_KEY не найден в .env.local" },
        { status: 500 }
      );
    }

    const defaultPrompt = prompt || `Studio product placement, style: ${style || "commercial"}, professional studio lighting, 8k render, photorealistic`;

    // 1. Вызываем генерацию на Fal.ai
    const response = await fetch("https://fal.run/fal-ai/flux/dev", {
      method: "POST",
      headers: {
        "Authorization": `Key ${falApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: defaultPrompt,
        image_url: imageUrl,
        sync_mode: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Fal.ai Details:", errorData);
      
      const errorMessage = errorData.detail || errorData.message || JSON.stringify(errorData);
      return NextResponse.json(
        { error: `Fal.ai status ${response.status}: ${errorMessage}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    const falResultUrl = result.images?.[0]?.url || null;

    if (!falResultUrl) {
      return NextResponse.json(
        { error: "Fal.ai не вернул изображение" },
        { status: 500 }
      );
    }

    const storedUrl =
      (await saveGeneratedImageToStorage(falResultUrl)) || falResultUrl;

    const savedGeneration = await saveGenerationRecord({
      originalImageUrl: imageUrl,
      resultImageUrl: storedUrl,
      prompt: defaultPrompt,
      style: style || "commercial",
      productName,
      category,
    });

    return NextResponse.json({
      success: true,
      resultUrl: storedUrl,
      generation: savedGeneration,
    });
  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера: " + (error.message || "") },
      { status: 500 }
    );
  }
}