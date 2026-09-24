import { NextResponse } from "next/server";
import { CATEGORY_IDS } from "@/lib/categories";
import {
  GEMINI_ANALYZE_MODELS,
  GeminiRequestError,
  generateGeminiContent,
} from "@/lib/gemini";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY missing in .env.local" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image is too large. Maximum size is 10 MB." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString("base64");

    const prompt = `
Analyze this product image.

Return a JSON object with:
- productName: short product title
- categoryId: exactly one of:
${CATEGORY_IDS.map((id) => `  ${id}`).join("\n")}

Do not invent a brand or model that is not clearly visible.
If the product cannot be identified reliably, use "other".
`;

    const { result } = await generateGeminiContent({
      apiKey,
      models: GEMINI_ANALYZE_MODELS,
      body: {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: file.type,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              productName: { type: "STRING" },
              categoryId: {
                type: "STRING",
                enum: CATEGORY_IDS,
              },
            },
            required: ["productName", "categoryId"],
          },
        },
      },
    });

    const payload = result as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const responseText = payload.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      return NextResponse.json(
        { error: "Gemini returned an empty response" },
        { status: 502 }
      );
    }

    let data: {
      productName: string;
      categoryId: string;
    };

    try {
      data = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        {
          error: "Gemini returned invalid JSON",
          raw: responseText,
        },
        { status: 502 }
      );
    }

    if (typeof data.productName !== "string" || !data.productName.trim()) {
      return NextResponse.json({ error: "Invalid productName" }, { status: 502 });
    }

    if (!CATEGORY_IDS.includes(data.categoryId)) {
      return NextResponse.json({ error: "Invalid categoryId" }, { status: 502 });
    }

    return NextResponse.json({
      productName: data.productName.trim(),
      categoryId: data.categoryId,
    });
  } catch (error) {
    if (error instanceof GeminiRequestError) {
      console.error("GEMINI API ERROR:", error.message);
      return NextResponse.json(
        {
          error: error.message,
          retryable: isLikelyBusy(error),
        },
        { status: error.status || 503 }
      );
    }

    console.error("ANALYSIS ROUTE ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

function isLikelyBusy(error: GeminiRequestError): boolean {
  return error.status === 429 || error.status === 503;
}
