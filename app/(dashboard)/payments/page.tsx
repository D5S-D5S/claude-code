import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  TrendingUp,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default async function PaymentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/login");
  const userId = user?.id ?? "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  const { data: paidQuotes } = await supabase
    .from("quotes")
    .select("total, paid_at")
    .eq("profile_id", userId)
    .eq("payment_status", "paid");

  const totalRevenue = paidQuotes?.reduce((sum, q) => sum + (q.total || 0), 0) || 0;
  const thisMonth = paidQuotes?.filter((q) => {
    const paid = new Date(q.paid_at || "");
    const now = new Date();
    return paid.getMonth() === now.getMonth() && paid.getFullYear() === now.getFullYear();
  }).reduce((sum, q) => sum + (q.total || 0), 0) || 0;

  const currency = profile?.currency || "GBP";
  const symbol = profile?.currency_symbol || "£";
  const platformFee = profile?.platform_fee_percent || 2;
  const platformEarnings = (totalRevenue * platformFee) / 100;

  const stripeConnected = profile?.stripe_connected || false;
  const connectUrl = `/api/stripe/connect?user_id=${userId}`;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-gray-500 text-sm mt-1">Manage Stripe Connect and track revenue</p>
      </div>

      {/* Revenue stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(totalRevenue, currency, symbol)}
          </p>
          <p className="text-sm text-gray-500 mt-1">Total Revenue (paid)</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(thisMonth, currency, symbol)}
          </p>
          <p className="text-sm text-gray-500 mt-1">This Month</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center mb-3">
            <CreditCard className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(platformEarnings, currency, symbol)}
          </p>
          <p className="text-sm text-gray-500 mt-1">Platform Earnings ({platformFee}%)</p>
        </div>
      </div>

      {/* Stripe Connect */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-bold text-gray-900">Stripe Connect</h2>
              {stripeConnected ? (
                <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                  <AlertCircle className="w-3 h-3" /> Not connected
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 max-w-lg">
              Connect your Stripe account to accept card payments and Klarna from your customers.
              Your {platformFee}% platform fee is automatically deducted on every transaction.
            </p>
          </div>
          {!stripeConnected && (
            <a
              href={connectUrl}
              className="flex items-center gap-2 bg-[#6772e5] hover:bg-[#5469d4] text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-all flex-shrink-0"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
              </svg>
              Connect with Stripe
            </a>
          )}
          {stripeConnected && (
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl px-4 py-2.5 text-sm transition-all"
            >
              Stripe Dashboard <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {stripeConnected && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Account ID</p>
              <p className="text-sm font-mono text-gray-700">{profile?.stripe_account_id || "—"}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Platform Fee</p>
              <p className="text-sm font-bold text-orange-600">{platformFee}%</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Fee passes to customer</p>
              <p className="text-sm font-bold text-gray-700">
                {profile?.pass_fee_to_customer ? "Yes" : "No (absorbed)"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Payment methods info */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-gray-900 mb-4">Accepted Payment Methods</h2>
          <div className="space-y-3">
            {[
              { name: "Credit & Debit Cards", desc: "Visa, Mastercard, Amex", enabled: true },
              { name: "Klarna", desc: "Buy now, pay later — 3 instalments", enabled: stripeConnected },
              { name: "Apple Pay", desc: "Instant checkout on iOS", enabled: stripeConnected },
              { name: "Google Pay", desc: "Instant checkout on Android", enabled: stripeConnected },
            ].map((method) => (
              <div key={method.name} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{method.name}</p>
                  <p className="text-xs text-gray-400">{method.desc}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  method.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {method.enabled ? "Active" : "Requires Stripe"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-gray-900 mb-4">Fee Structure</h2>
          <div className="space-y-3">
            <div className="bg-orange-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-orange-800">Platform Fee</span>
                <span className="text-lg font-bold text-orange-600">{platformFee}%</span>
              </div>
              <p className="text-xs text-orange-600">
                Applied to every transaction processed through Balloon Base.
                Configure in Settings.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">Stripe Processing</span>
                <span className="text-sm font-bold text-gray-900">1.4% + 20p</span>
              </div>
              <p className="text-xs text-gray-500">
                Standard Stripe rate for European cards. Applied by Stripe separately.
              </p>
            </div>
          </div>

          <a
            href="/settings"
            className="mt-4 flex items-center justify-between text-sm text-orange-500 hover:text-orange-600 font-medium"
          >
            Configure fee settings <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
