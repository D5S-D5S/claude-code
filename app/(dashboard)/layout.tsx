import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/Sidebar";
import { Profile } from "@/types";

const PREVIEW_PROFILE: Profile = {
  id: "preview",
  business_name: "Demo Business",
  currency: "GBP",
  currency_symbol: "£",
  plan: "pro",
} as Profile;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    redirect("/login");
  }

  const { data: profileData } = user
    ? await supabase.from("profiles").select("*").eq("id", user.id).single()
    : { data: null };

  const profile = (profileData as Profile | null) ?? (user ? null : PREVIEW_PROFILE);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar profile={profile} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
