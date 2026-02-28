import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing webhook signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createClient();

  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const quoteId = paymentIntent.metadata?.quote_id;

      if (quoteId) {
        await supabase
          .from("quotes")
          .update({
            payment_status: "paid",
            stripe_payment_intent_id: paymentIntent.id,
            paid_at: new Date().toISOString(),
            status: "paid",
          })
          .eq("id", quoteId);
      }
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.CheckoutSession;
      const quoteId = session.metadata?.quote_id;

      if (quoteId) {
        await supabase
          .from("quotes")
          .update({
            payment_status: "paid",
            stripe_checkout_session_id: session.id,
            paid_at: new Date().toISOString(),
            status: "paid",
          })
          .eq("id", quoteId);

        // Update customer total_spent
        const { data: quote } = await supabase
          .from("quotes")
          .select("customer_id, total")
          .eq("id", quoteId)
          .single();

        if (quote?.customer_id) {
          const { data: customer } = await supabase
            .from("customers")
            .select("total_spent, quotes_count")
            .eq("id", quote.customer_id)
            .single();

          if (customer) {
            await supabase
              .from("customers")
              .update({
                total_spent: (customer.total_spent || 0) + (quote.total || 0),
              })
              .eq("id", quote.customer_id);
          }
        }
      }
      break;
    }

    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      // Update stripe_connected status when account finishes onboarding
      if (account.details_submitted) {
        await supabase
          .from("profiles")
          .update({ stripe_connected: true })
          .eq("stripe_account_id", account.id);
      }
      break;
    }

    default:
      // Unhandled event type - that's fine
      break;
  }

  return NextResponse.json({ received: true });
}
