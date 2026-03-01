import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

// GET /api/stripe/connect — redirect to Stripe OAuth
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe not configured. Add STRIPE_SECRET_KEY to .env" },
      { status: 503 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Create a Stripe Connect account link
  try {
    const account = await stripe.accounts.create({
      type: "express",
      metadata: { user_id: user.id },
    });

    // Save the account ID to profile
    await supabase
      .from("profiles")
      .update({ stripe_account_id: account.id })
      .eq("id", user.id);

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${appUrl}/api/stripe/connect?user_id=${user.id}`,
      return_url: `${appUrl}/api/stripe/callback?account=${account.id}&user_id=${user.id}`,
      type: "account_onboarding",
    });

    return NextResponse.redirect(accountLink.url);
  } catch (error) {
    console.error("Stripe Connect error:", error);
    return NextResponse.redirect(new URL("/payments?error=stripe_connect_failed", req.url));
  }
}
