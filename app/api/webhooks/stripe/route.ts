import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseCredits(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}

async function addCreditsToProfile(
  userId: string,
  creditsToAdd: number,
  stripeSessionId: string
) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    console.error(
      "[stripe-webhook] SUPABASE_SERVICE_ROLE_KEY is missing; cannot update profiles"
    );
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
  }

  const { data, error } = await supabase.rpc("add_profile_credits", {
    p_user_id: userId,
    p_credits: creditsToAdd,
    p_stripe_session_id: stripeSessionId,
  });

  if (!error) {
    console.log("[stripe-webhook] Credits added via RPC", {
      userId,
      creditsToAdd,
      nextCredits: data,
      stripeSessionId,
    });
    return;
  }

  console.warn(
    "[stripe-webhook] add_profile_credits RPC unavailable, using fallback:",
    error.message
  );

  const { error: ledgerError } = await supabase.from("credit_purchases").insert({
    user_id: userId,
    stripe_session_id: stripeSessionId,
    credits: creditsToAdd,
  });

  if (ledgerError && ledgerError.code !== "23505") {
    console.error("[stripe-webhook] credit_purchases insert failed:", ledgerError);
    throw new Error(ledgerError.message);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("[stripe-webhook] profiles lookup failed:", profileError);
    throw new Error(profileError.message);
  }

  const currentCredits =
    typeof profile?.credits === "number" ? profile.credits : 0;

  const nextCredits =
    ledgerError?.code === "23505"
      ? currentCredits
      : currentCredits + creditsToAdd;

  const { error: upsertError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      credits: nextCredits,
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    console.error("[stripe-webhook] profiles upsert failed:", upsertError);
    if (ledgerError?.code !== "23505") {
      await supabase
        .from("credit_purchases")
        .delete()
        .eq("stripe_session_id", stripeSessionId);
    }
    throw new Error(upsertError.message);
  }

  console.log("[stripe-webhook] Credits added", {
    userId,
    creditsToAdd,
    nextCredits,
    stripeSessionId,
  });
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is missing");
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET не найден в .env.local" },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error("[stripe-webhook] Signature verification failed:", error);
    return NextResponse.json(
      {
        error:
          "Invalid Stripe signature: " +
          (error instanceof Error ? error.message : ""),
      },
      { status: 400 }
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_status && session.payment_status !== "paid") {
        console.warn(
          "[stripe-webhook] Ignoring unpaid checkout session",
          session.id,
          session.payment_status
        );
        return NextResponse.json({ received: true });
      }

      const userId = session.metadata?.userId;
      const creditsToAdd = parseCredits(
        session.metadata?.creditsToAdd || session.metadata?.credits
      );

      if (!userId || !creditsToAdd) {
        console.error(
          "[stripe-webhook] Missing userId or creditsToAdd in metadata",
          session.metadata
        );
        return NextResponse.json(
          { error: "Missing userId or creditsToAdd in session metadata" },
          { status: 400 }
        );
      }

      await addCreditsToProfile(userId, creditsToAdd, session.id);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe-webhook] Handler failed:", error);
    return NextResponse.json(
      {
        error:
          "Webhook handler failed: " +
          (error instanceof Error ? error.message : ""),
      },
      { status: 500 }
    );
  }
}
