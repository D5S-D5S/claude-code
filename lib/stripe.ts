import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

export const PLATFORM_FEE_PERCENT = parseFloat(
  process.env.STRIPE_PLATFORM_FEE_PERCENT || "2"
);
