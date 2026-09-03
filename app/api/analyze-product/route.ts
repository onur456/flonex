import { NextResponse } from "next/server";
import { CATEGORY_IDS } from "@/lib/categories";

const MODEL = "gemini-3.5-flash-lite";

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
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
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
                productName: {
                  type: "STRING",
                },
                categoryId: {
                  type: "STRING",
                  enum: CATEGORY_IDS,
                },
              },
              required: ["productName", "categoryId"],
            },
          },
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("GEMINI API ERROR:", result);

      return NextResponse.json(
        {
          error:
            result?.error?.message ||
            `Gemini API Error: ${response.status}`,
        },
        { status: response.status }
      );
    }

    const responseText =
      result?.candidates?.[0]?.content?.parts?.[0]?.text;

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

    if (
      typeof data.productName !== "string" ||
      !data.productName.trim()
    ) {
      return NextResponse.json(
        { error: "Invalid productName" },
        { status: 502 }
      );
    }

    if (!CATEGORY_IDS.includes(data.categoryId)) {
      return NextResponse.json(
        { error: "Invalid categoryId" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      productName: data.productName.trim(),
      categoryId: data.categoryId,
    });
  } catch (error) {
    console.error("ANALYSIS ROUTE ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}