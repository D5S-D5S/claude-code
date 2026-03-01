import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Lazy Stripe getter — only initializes when first called.
 * Throws a clear error if STRIPE_SECRET_KEY is missing,
 * but does NOT crash at module import time (safe for prerender).
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set. Add it to your environment variables."
      );
    }
    _stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  }
  return _stripe;
}

export const PLATFORM_FEE_PERCENT = parseFloat(
  process.env.STRIPE_PLATFORM_FEE_PERCENT || "2"
);
