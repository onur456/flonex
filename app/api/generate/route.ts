import { NextResponse } from "next/server";
import { asJsonRecord, pickString } from "@/lib/fal";
import {
  generateImageResponse,
  generateVideoResponse,
} from "@/lib/generateFalMedia";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = asJsonRecord(await request.json().catch(() => ({})));
    const contentType =
      pickString(body, "contentType", "content_type") || "photo";

    if (contentType === "video") {
      return generateVideoResponse(body);
    }

    return generateImageResponse(body);
  } catch (error) {
    console.error("[generate] Unexpected error:", error);
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
