import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Search, FileText, Send, CheckCircle, XCircle } from "lucide-react";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";

export default async function QuotesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/login");
  const userId = user?.id ?? "";

  const [{ data: profile }, { data: quotes }] = await Promise.all([
    supabase.from("profiles").select("currency, currency_symbol").eq("id", userId).single(),
    supabase
      .from("quotes")
      .select("*, customer:customers(name, email)")
      .eq("profile_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const currency = profile?.currency || "GBP";
  const symbol = profile?.currency_symbol || "£";

  const statuses = ["draft", "sent", "viewed", "approved", "paid", "rejected"];
  const statusCounts = statuses.reduce((acc, s) => {
    acc[s] = quotes?.filter((q) => q.status === s).length || 0;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
          <p className="text-gray-500 text-sm mt-1">Manage and send quotes to your customers</p>
        </div>
        <Link
          href="/quotes/new"
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          New Quote
        </Link>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {statuses.map((s) => (
          <div key={s} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{statusCounts[s]}</p>
            <p className="text-xs text-gray-500 capitalize mt-1">{s}</p>
          </div>
        ))}
      </div>

      {/* Quotes table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              placeholder="Search quotes..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>
        </div>

        {quotes && quotes.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Quote #</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Customer</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Event</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Total</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Created</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {quotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-gray-50 transition-all">
                  <td className="px-4 py-3">
                    <Link
                      href={`/quotes/${quote.id}`}
                      className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                    >
                      {quote.quote_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">
                      {quote.customer?.name || "—"}
                    </p>
                    <p className="text-xs text-gray-400">{quote.customer?.email || ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-600">{quote.event_type || "—"}</p>
                    {quote.event_date && (
                      <p className="text-xs text-gray-400">{formatDate(quote.event_date)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getStatusColor(quote.status)}`}>
                      {quote.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-bold text-gray-900">
                      {formatCurrency(quote.total || 0, currency, symbol)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500">{formatDate(quote.created_at)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/quotes/${quote.id}`}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        title="View"
                      >
                        <FileText className="w-4 h-4" />
                      </Link>
                      {quote.status === "draft" && (
                        <button
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600"
                          title="Send"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium mb-1">No quotes yet</p>
            <p className="text-gray-400 text-sm mb-4">Create your first quote to get started</p>
            <Link
              href="/quotes/new"
              className="inline-flex items-center gap-2 bg-orange-500 text-white text-sm font-semibold rounded-xl px-4 py-2 hover:bg-orange-600 transition-all"
            >
              <Plus className="w-4 h-4" /> Create Quote
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
