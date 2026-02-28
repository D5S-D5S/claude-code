import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import QuoteBuilder from "@/components/quotes/QuoteBuilder";

export default async function NewQuotePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: profile },
    { data: pricingTiers },
    { data: customers },
    { data: packages },
    { data: addons },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("pricing_tiers")
      .select("*")
      .eq("profile_id", user.id)
      .eq("is_active", true)
      .order("tier_number"),
    supabase
      .from("customers")
      .select("id, name, email, phone")
      .eq("profile_id", user.id)
      .order("name"),
    supabase
      .from("packages")
      .select("*")
      .eq("profile_id", user.id)
      .eq("is_active", true),
    supabase
      .from("addons")
      .select("*")
      .eq("profile_id", user.id)
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
