import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { quote_id } = await req.json();

  if (!quote_id) {
    return NextResponse.json({ error: "quote_id required" }, { status: 400 });
  }

  const [{ data: quote }, { data: profile }] = await Promise.all([
    supabase.from("quotes").select("*, customer:customers(name, email)").eq("id", quote_id).single(),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
  ]);

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  if (!profile?.stripe_account_id) {
    return NextResponse.json({ error: "Stripe not connected" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const platformFeePercent = profile.platform_fee_percent || 2;
  const amountInCents = Math.round((quote.total || 0) * 100);
  const applicationFeeAmount = Math.round(amountInCents * platformFeePercent / 100);

  const session = await getStripe().checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: (profile.currency || "gbp").toLowerCase(),
            product_data: {
              name: `Balloon Decoration — ${quote.quote_number}`,
              description: quote.event_type || "Balloon decoration service",
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      customer_email: quote.customer?.email || undefined,
      metadata: {
        quote_id: quote.id,
        user_id: user.id,
      },
      success_url: `${appUrl}/quotes/${quote.id}?paid=true`,
      cancel_url: `${appUrl}/quotes/${quote.id}`,
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
        transfer_data: {
          destination: profile.stripe_account_id,
        },
        metadata: {
          quote_id: quote.id,
        },
      },
    }
  );

  return NextResponse.json({ url: session.url });
}
