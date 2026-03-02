import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import QuoteBuilder from "@/components/quotes/QuoteBuilder";

export default async function NewQuotePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/login");
  const userId = user?.id ?? "";

  const [
    { data: profile },
    { data: pricingTiers },
    { data: customers },
    { data: packages },
    { data: addons },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase
      .from("pricing_tiers")
      .select("*")
      .eq("profile_id", userId)
      .eq("is_active", true)
      .order("tier_number"),
    supabase
      .from("customers")
      .select("id, name, email, phone")
      .eq("profile_id", userId)
      .order("name"),
    supabase
      .from("packages")
      .select("*")
      .eq("profile_id", userId)
      .eq("is_active", true),
    supabase
      .from("addons")
      .select("*")
      .eq("profile_id", userId)
      .eq("is_active", true),
  ]);

  return (
    <QuoteBuilder
      profile={profile}
      pricingTiers={pricingTiers || []}
      customers={customers || []}
      packages={packages || []}
      addons={addons || []}
    />
  );
}
