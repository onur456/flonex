import { NextResponse } from "next/server";
import {
  CREDIT_PACKS,
  toStripeUnitAmount,
} from "@/lib/credits";
import { getAppOrigin, getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(body: Record<string, unknown>, key: string): number | undefined {
  const value = body[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export async function POST(request: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY?.trim()) {
      console.error("[checkout] STRIPE_SECRET_KEY is missing");
      return NextResponse.json(
        { error: "STRIPE_SECRET_KEY не найден в .env.local" },
        { status: 500 }
      );
    }

    const body = asRecord(await request.json().catch(() => ({})));
    const userId = readString(body, "userId");
    const credits = readNumber(body, "credits");
    const priceAmount = readNumber(body, "priceAmount");

    if (!userId) {
      return NextResponse.json(
        { error: "userId обязателен" },
        { status: 400 }
      );
    }

    if (!credits || !Number.isInteger(credits) || credits < 1 || credits > 1000) {
      return NextResponse.json(
        { error: "credits должен быть целым числом от 1 до 1000" },
        { status: 400 }
      );
    }

    if (priceAmount === undefined || priceAmount <= 0) {
      return NextResponse.json(
        { error: "priceAmount обязателен и должен быть больше 0" },
        { status: 400 }
      );
    }

    const unitAmount = toStripeUnitAmount(priceAmount);
    const knownPack = CREDIT_PACKS.find((pack) => pack.credits === credits);
    if (knownPack && unitAmount !== knownPack.priceAmount) {
      return NextResponse.json(
        { error: "priceAmount не совпадает с тарифом пакета кредитов" },
        { status: 400 }
      );
    }

    if (!knownPack && unitAmount < credits * 10) {
      return NextResponse.json(
        { error: "Слишком низкая цена за кредиты" },
        { status: 400 }
      );
    }

    const origin = getAppOrigin(request);
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: unitAmount,
            product_data: {
              name: `${credits} FLONEX credits`,
              description: "AI generation credits for FLONEX Content Studio",
            },
          },
        },
      ],
      metadata: {
        userId,
        credits: String(credits),
        creditsToAdd: String(credits),
      },
      client_reference_id: userId,
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=canceled`,
    });

    if (!session.url) {
      console.error("[checkout] Stripe session created without url", session.id);
      return NextResponse.json(
        { error: "Stripe не вернул URL оплаты" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[checkout] Failed to create Stripe session:", error);
    return NextResponse.json(
      {
        error:
          "Не удалось создать сессию оплаты: " +
          (error instanceof Error ? error.message : ""),
      },
      { status: 500 }
    );
  }
}
