import { NextResponse, type NextRequest } from "next/server";
import { isSocialPlatform, type SocialPlatform } from "@/lib/social";

export const runtime = "nodejs";

const MOCK_LATENCY_MS = 600;

const HOOKS = [
  "Новая съёмка — и она говорит сама за себя.",
  "Это тот самый кадр, который хочется сохранить.",
  "Сделали студийный вид без студии.",
];

const HASHTAGS: Record<SocialPlatform, string[]> = {
  instagram: ["#flonex", "#aicontent", "#productphoto", "#ecommerce"],
  facebook: ["#flonex", "#smallbusiness", "#newarrival"],
  tiktok: ["#flonex", "#aivideo", "#tiktokmademebuyit", "#fyp"],
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/**
 * Заглушка «AI Enhance Caption»: собирает подпись по шаблону. Реальную версию
 * стоит повесить на Gemini, как это уже сделано в `/api/suggest-prompt`.
 */
export async function POST(request: NextRequest) {
  const body = asRecord(await request.json().catch(() => ({})));

  const caption = typeof body.caption === "string" ? body.caption.trim() : "";
  const productName =
    typeof body.productName === "string" && body.productName.trim()
      ? body.productName.trim()
      : "наш продукт";
  const platforms = Array.isArray(body.platforms)
    ? body.platforms.filter(isSocialPlatform)
    : [];

  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));

  const hook = HOOKS[Math.floor(Math.random() * HOOKS.length)];
  const lead = caption || `${productName} — в наличии и готов к заказу.`;

  const tags = new Set<string>();
  const sources = platforms.length > 0 ? platforms : (["instagram"] as SocialPlatform[]);
  for (const platform of sources) {
    for (const tag of HASHTAGS[platform]) {
      tags.add(tag);
    }
  }

  const enhanced = `${hook}\n\n${lead}\n\n${Array.from(tags).join(" ")}`;

  return NextResponse.json({ caption: enhanced });
}
