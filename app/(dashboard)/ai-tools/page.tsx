import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AIEstimator from "@/components/ai/AIEstimator";
import MockupGenerator from "@/components/ai/MockupGenerator";
import { Sparkles, Lock } from "lucide-react";
import Link from "next/link";

export default async function AIToolsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/login");
  const userId = user?.id ?? "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, currency, currency_symbol")
    .eq("id", userId)
    .single();

  const isPro = profile?.plan === "pro" || profile?.plan === "enterprise";

  if (!isPro) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-orange-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">AI Tools — Pro Feature</h1>
          <p className="text-gray-500 mb-6">
            Upgrade to Pro to unlock the AI Length Estimator, Mockup Generator, and
            other AI-powered tools that save you hours every week.
          </p>
          <div className="bg-orange-50 rounded-2xl p-5 mb-6 text-left">
            <h3 className="font-semibold text-orange-800 mb-3">What you get with Pro:</h3>
            <ul className="space-y-2">
              {[
                "AI Length Estimator — upload customer photos to measure balloon length",
                "AI Mockup Generator — generate design previews instantly",
                "Unlimited customers and quotes",
                "Custom storefront page",
                "Automated email reminders",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-orange-700">
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <Link
            href="/settings/billing"
            className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-6 py-3 text-sm transition-all"
          >
            Upgrade to Pro — £49/month
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-orange-500" />
          <h1 className="text-2xl font-bold text-gray-900">AI Tools</h1>
          <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full">Pro</span>
        </div>
        <p className="text-gray-500 text-sm">AI-powered tools to speed up your quoting workflow</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <AIEstimator currency={profile?.currency || "GBP"} symbol={profile?.currency_symbol || "£"} />
        <MockupGenerator />
      </div>
    </div>
  );
}
