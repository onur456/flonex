import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3.6-flash";

export async function POST(request: Request) {
  const fallbackIdeas = [
    "High-end commercial product scene, dramatic studio lighting, minimalist presentation, subtle surface reflections, 8k resolution",
    "Modern e-commerce setting, ultra-detailed composition, clean soft shadows, professional studio background, perfectly framed",
    "Aesthetic studio environment, premium lighting setup, sleek surfaces, highly detailed product photography, cinematic depth of field",
    "Luxury product display, golden hour natural light, organic textures, editorial product layout, photorealistic 8k render",
    "Vibrant product presentation, sharp focus, dynamic ambient lighting, modern aesthetic, high conversion marketplace layout",
    "Sleek tech backdrop with neon subtle accents, macro lens focus, professional studio photography, ultra-crisp detail",
    "Soft pastel studio backdrop, elegant geometric props, soft shadow balance, commercial hero shot, highly detailed",
    "Industrial concrete pedestal, harsh sunlight with Venetian blind shadows, dramatic contrast, high fashion product shot",
  ];

  const getRandomFallback = () => {
    return fallbackIdeas[
      Math.floor(Math.random() * fallbackIdeas.length)
    ];
  };

  try {
    const body = await request.json().catch(() => ({}));

    const contentType = body?.contentType || "photo";
    const style = body?.style || "commercial";
    const productName = body?.productName || "";
    const category = body?.category || "";
    const shotType = body?.shotType || "";
    const shotTypePrompt = body?.shotTypePrompt || "";

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn(
        "[Gemini API] GEMINI_API_KEY is missing"
      );

      return NextResponse.json({
        prompt: getRandomFallback(),
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
    });

    const randomSeed = Math.random()
      .toString(36)
      .substring(2, 10);

    const promptText = `
You are a creative AI prompt engineer for commercial e-commerce product photography.

Generate ONE unique, creative, high-converting English prompt for generating a product visual.

Content type: ${contentType}
Style: ${style}
${productName ? `Product: ${productName}` : ""}
${category ? `Category: ${category}` : ""}
${shotType ? `Shot type: ${shotType}` : ""}
${shotTypePrompt ? `Shot type means: ${shotTypePrompt}` : ""}
Random Seed: ${randomSeed}

Instructions:
- Be highly creative and unique every time.
- Create a realistic commercial product photography scene.
- Respect the shot type above: the scene must stay that kind of shot.
- Include appropriate lighting, composition, background and atmosphere.
- Make the result suitable for an e-commerce marketplace.
- Return ONLY the prompt text.
- Do NOT use quotation marks.
- Do NOT add introductions or explanations.
- Keep it under 35 words.
`;

    const interaction = await ai.interactions.create({
      model: MODEL,
      input: promptText,
    });

    const generatedText =
      interaction.output_text?.trim();

    if (generatedText) {
      console.log(
        "Gemini AI Idea generated successfully"
      );

      return NextResponse.json({
        prompt: generatedText,
      });
    }

    return NextResponse.json({
      prompt: getRandomFallback(),
    });
  } catch (error) {
    console.error(
      "[Gemini Error Details]:",
      error instanceof Error
        ? error.message
        : error
    );

    return NextResponse.json({
      prompt: getRandomFallback(),
    });
  }
}