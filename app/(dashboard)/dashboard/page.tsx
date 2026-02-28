import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp,
  FileText,
  Users,
  Calendar,
  Plus,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
} from "lucide-react";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: profile },
    { data: quotes, count: quotesCount },
    { data: customers, count: customersCount },
    { data: jobs },
    { data: inventory },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("quotes")
      .select("*, customer:customers(name)", { count: "exact" })
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("customers")
      .select("*", { count: "exact" })
      .eq("profile_id", user.id),
    supabase
      .from("jobs")
      .select("*, customer:customers(name)")
      .eq("profile_id", user.id)
      .eq("status", "scheduled")
      .order("scheduled_date", { ascending: true })
      .limit(5),
    supabase
      .from("inventory")
      .select("*")
      .eq("profile_id", user.id)
      .filter("quantity_in_stock", "lte", "low_stock_threshold"),
  ]);

  const currency = profile?.currency || "GBP";
  const symbol = profile?.currency_symbol || "£";

  // Revenue calculation from paid quotes
  const { data: paidQuotes } = await supabase
    .from("quotes")
    .select("total")
    .eq("profile_id", user.id)
    .eq("payment_status", "paid");

  const totalRevenue = paidQuotes?.reduce((sum, q) => sum + (q.total || 0), 0) || 0;

  const activeQuotes = quotes?.filter((q) =>
    ["sent", "viewed", "approved"].includes(q.status)
  ).length || 0;

  const businessName = profile?.business_name || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting}, {businessName} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Here&apos;s what&apos;s happening with your business today.
          </p>
        </div>
        <Link
          href="/quotes/new"
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          New Quote
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(totalRevenue, currency, symbol)}
          icon={TrendingUp}
          iconColor="text-green-600"
          iconBg="bg-green-100"
          trend="+12% this month"
        />
        <StatCard
          label="Active Quotes"
          value={String(activeQuotes)}
          icon={FileText}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
          trend={`${quotesCount || 0} total`}
        />
        <StatCard
          label="Customers"
          value={String(customersCount || 0)}
          icon={Users}
          iconColor="text-purple-600"
          iconBg="bg-purple-100"
          trend="CRM records"
        />
        <StatCard
          label="Upcoming Jobs"
          value={String(jobs?.length || 0)}
          icon={Calendar}
          iconColor="text-orange-600"
          iconBg="bg-orange-100"
          trend="scheduled installs"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Recent Quotes */}
        <div className="col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Quotes</h2>
            <Link
              href="/quotes"
              className="text-sm text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {quotes && quotes.length > 0 ? (
            <div className="space-y-3">
              {quotes.map((quote) => (
                <Link
                  key={quote.id}
                  href={`/quotes/${quote.id}`}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
                      <FileText className="w-4 h-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {quote.customer?.name || "No customer"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {quote.quote_number} · {formatDate(quote.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getStatusColor(quote.status)}`}>
                      {quote.status}
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {formatCurrency(quote.total || 0, currency, symbol)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              message="No quotes yet"
              action={{ label: "Create your first quote", href: "/quotes/new" }}
            />
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Upcoming Jobs */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Upcoming Jobs</h2>
              <Link href="/calendar" className="text-sm text-orange-500 font-medium">
                Calendar
              </Link>
            </div>
            {jobs && jobs.length > 0 ? (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div key={job.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{job.title || job.customer?.name}</p>
                      <p className="text-xs text-gray-400">{formatDate(job.scheduled_date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No upcoming jobs</p>
            )}
          </div>

          {/* Low Stock Alerts */}
          {inventory && inventory.length > 0 && (
            <div className="bg-amber-50 rounded-2xl border border-amber-100 p-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h2 className="font-semibold text-amber-800 text-sm">Low Stock Alert</h2>
              </div>
              <div className="space-y-2">
                {inventory.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <p className="text-sm text-amber-700">{item.name}</p>
                    <span className="text-xs font-bold text-red-600">{item.quantity_in_stock} left</span>
                  </div>
                ))}
              </div>
              <Link
                href="/inventory"
                className="mt-3 block text-center text-xs font-semibold text-amber-700 hover:text-amber-800"
              >
                View inventory →
              </Link>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <QuickAction href="/quotes/new" label="New Quote" icon={FileText} />
              <QuickAction href="/customers" label="Add Customer" icon={Users} />
              <QuickAction href="/calendar" label="Schedule Job" icon={Calendar} />
              <QuickAction href="/ai-tools" label="AI Estimator" icon={DollarSign} pro={profile?.plan === "starter"} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  trend,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  trend: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-sm text-gray-500 mb-2">{label}</p>
      <div className="flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3 text-green-500" />
        <span className="text-xs text-gray-400">{trend}</span>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  label,
  icon: Icon,
  pro,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pro?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-orange-50 transition-all group"
    >
      <Icon className="w-4 h-4 text-gray-400 group-hover:text-orange-500" />
      <span className="text-sm text-gray-700 group-hover:text-gray-900 flex-1">{label}</span>
      {pro && (
        <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-1.5 py-0.5 rounded-full">
          Pro
        </span>
      )}
      <ArrowRight className="w-3 h-3 text-gray-300 group-hover:text-orange-400" />
    </Link>
  );
}

function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="text-center py-8">
      <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
        <Icon className="w-6 h-6 text-gray-400" />
      </div>
      <p className="text-sm text-gray-400 mb-3">{message}</p>
      {action && (
        <Link
          href={action.href}
          className="text-sm text-orange-500 hover:text-orange-600 font-medium"
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}
