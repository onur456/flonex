export const DEFAULT_CREDIT_BALANCE = 20;

export const CREDIT_PACKS = [
  { credits: 20, priceAmount: 499, label: "20 credits", priceLabel: "$4.99" },
  { credits: 50, priceAmount: 999, label: "50 credits", priceLabel: "$9.99" },
  { credits: 120, priceAmount: 1999, label: "120 credits", priceLabel: "$19.99" },
] as const;

export const DEFAULT_CREDIT_PACK = CREDIT_PACKS[1];

export type CreditPack = (typeof CREDIT_PACKS)[number];

export function toStripeUnitAmount(priceAmount: number): number {
  if (!Number.isFinite(priceAmount) || priceAmount <= 0) {
    throw new Error("Invalid priceAmount");
  }

  if (!Number.isInteger(priceAmount)) {
    return Math.round(priceAmount * 100);
  }

  return priceAmount;
}

export const stripePublishableKey =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
