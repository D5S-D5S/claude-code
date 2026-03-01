import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

// Stripe Connect callback — mark account as connected
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("account");
  const userId = searchParams.get("user_id");

  if (!accountId || !userId) {
    return NextResponse.redirect(new URL("/payments?error=missing_params", req.url));
  }

  try {
    // Verify the account is connected
    const account = await stripe.accounts.retrieve(accountId);

    if (account.details_submitted) {
      const supabase = await createClient();
      await supabase
        .from("profiles")
        .update({
          stripe_account_id: accountId,
          stripe_connected: true,
        })
        .eq("id", userId);
    }

    return NextResponse.redirect(new URL("/payments?connected=true", req.url));
  } catch (error) {
    console.error("Stripe callback error:", error);
    return NextResponse.redirect(new URL("/payments?error=callback_failed", req.url));
  }
}
