import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/Sidebar";
import { Profile } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth disabled — allow unauthenticated access
  let profile: Profile | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      profile = data as Profile | null;
    }
  } catch {
    // Supabase not configured — continue with null profile
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar profile={profile} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
