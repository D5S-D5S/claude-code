"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  Boxes,
  Calendar,
  CreditCard,
  Sparkles,
  Settings,
  LogOut,
  ChevronRight,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/quotes", label: "Quotes", icon: FileText },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/packages", label: "Packages", icon: Package },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/ai-tools", label: "AI Tools", icon: Sparkles, isPro: true },
  { href: "/settings/storefront", label: "Storefront", icon: Globe },
  { href: "/admin", label: "Admin", icon: ShieldCheck },
];

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const businessName = profile?.business_name || "My Business";
  const initials = businessName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-2xl">🎈</span>
          <span className="text-xl font-bold text-gray-900">
            Balloon<span className="text-orange-500">Base</span>
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-orange-50 text-orange-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-orange-500" : "text-gray-400 group-hover:text-gray-600"}`} />
                <span className="flex-1">{item.label}</span>
                {item.isPro && profile?.plan === "starter" && (
                  <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-1.5 py-0.5 rounded-full">
                    Pro
                  </span>
                )}
                {isActive && (
                  <ChevronRight className="w-4 h-4 text-orange-400" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-gray-100" />

        <Link
          href="/settings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
            pathname.startsWith("/settings")
              ? "bg-orange-50 text-orange-600"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          <Settings className="w-5 h-5 text-gray-400" />
          Settings
        </Link>
      </nav>

      {/* User profile + logout */}
      <div className="px-3 py-4 border-t border-gray-100">
        {profile?.plan === "starter" && (
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 mb-3">
            <p className="text-xs font-semibold text-orange-700 mb-1">Upgrade to Pro</p>
            <p className="text-xs text-orange-600 mb-2">
              Unlock AI tools, unlimited customers & storefront
            </p>
            <Link
              href="/settings/billing"
              className="block text-center text-xs font-semibold bg-orange-500 text-white rounded-lg py-1.5 hover:bg-orange-600 transition-all"
            >
              Upgrade Now
            </Link>
          </div>
        )}

        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition-all">
          <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{businessName}</p>
            <p className="text-xs text-gray-400 capitalize">{profile?.plan || "starter"} plan</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="text-gray-400 hover:text-red-500 transition-all p-1 rounded-lg hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
