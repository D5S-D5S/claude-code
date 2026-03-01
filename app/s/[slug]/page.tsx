import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { Phone, Mail, CheckCircle2 } from "lucide-react";

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // Get storefront by slug
  const { data: storefront } = await supabase
    .from("storefront_settings")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!storefront) {
    notFound();
  }

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, email, phone, city, currency, currency_symbol")
    .eq("id", storefront.profile_id)
    .single();

  // Get packages
  const { data: packages } = await supabase
    .from("packages")
    .select("*")
    .eq("profile_id", storefront.profile_id)
    .eq("is_active", true);

  // Get pricing tiers
  const { data: tiers } = await supabase
    .from("pricing_tiers")
    .select("*")
    .eq("profile_id", storefront.profile_id)
    .eq("is_active", true)
    .order("tier_number");

  const currency = profile?.currency || "GBP";
  const symbol = profile?.currency_symbol || "£";
  const accentColor = storefront.accent_color || "#F97316";

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div
        className="text-white py-16 px-4"
        style={{ backgroundColor: accentColor }}
      >
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-5xl mb-4">🎈</div>
          <h1 className="text-4xl font-bold mb-3">
            {profile?.business_name || "Balloon Business"}
          </h1>
          {storefront.headline && (
            <h2 className="text-2xl font-medium opacity-90 mb-2">{storefront.headline}</h2>
          )}
          {storefront.tagline && (
            <p className="text-lg opacity-80">{storefront.tagline}</p>
          )}
          {profile?.city && (
            <p className="mt-3 opacity-70 text-sm">📍 {profile.city}</p>
          )}
          <div className="flex justify-center gap-4 mt-6">
            {profile?.phone && (
              <a
                href={`tel:${profile.phone}`}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white rounded-full px-4 py-2 text-sm font-medium transition-all"
              >
                <Phone className="w-4 h-4" />
                {profile.phone}
              </a>
            )}
            {profile?.email && (
              <a
                href={`mailto:${profile.email}`}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white rounded-full px-4 py-2 text-sm font-medium transition-all"
              >
                <Mail className="w-4 h-4" />
                {profile.email}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Pricing Tiers */}
        {tiers && tiers.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Pricing</h2>
            <p className="text-gray-500 text-center mb-6 text-sm">Charged by the foot of balloon garland</p>
            <div className="grid grid-cols-3 gap-4">
              {tiers.map((tier, idx) => (
                <div
                  key={tier.id}
                  className={`rounded-2xl border-2 p-5 text-center ${
                    idx === 1 ? "border-orange-500 shadow-md" : "border-gray-200"
                  }`}
                >
                  {idx === 1 && (
                    <span className="text-xs font-bold text-orange-500 uppercase tracking-wide">
                      Most Popular
                    </span>
                  )}
                  <h3 className="font-bold text-gray-900 text-lg mt-1">{tier.name}</h3>
                  {tier.description && (
                    <p className="text-xs text-gray-500 mt-1 mb-3">{tier.description}</p>
                  )}
                  <p className="text-3xl font-bold" style={{ color: accentColor }}>
                    {symbol}{tier.price_per_foot}
                  </p>
                  <p className="text-xs text-gray-400">per foot</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    ({symbol}{tier.price_per_meter}/meter)
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Packages */}
        {storefront.show_packages && packages && packages.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Packages</h2>
            <p className="text-gray-500 text-center mb-6 text-sm">All-inclusive service bundles</p>
            <div className="grid grid-cols-2 gap-4">
              {packages.map((pkg) => (
                <div key={pkg.id} className="border border-gray-200 rounded-2xl p-5">
                  <h3 className="font-bold text-gray-900 mb-1">{pkg.name}</h3>
                  {pkg.description && (
                    <p className="text-sm text-gray-500 mb-3">{pkg.description}</p>
                  )}
                  {pkg.items && pkg.items.length > 0 && (
                    <ul className="space-y-1 mb-3">
                      {pkg.items.map((item: { name: string; quantity: number }, i: number) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          {item.quantity}× {item.name}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-2xl font-bold" style={{ color: accentColor }}>
                    {formatCurrency(pkg.price, currency, symbol)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Contact form */}
        {storefront.show_contact_form && (
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Get a Quote</h2>
            <p className="text-gray-500 text-center mb-6 text-sm">
              Fill in the form below and we&apos;ll get back to you with a personalised quote
            </p>
            <div className="bg-gray-50 rounded-2xl p-6">
              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Your name"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 bg-white"
                      style={{ "--tw-ring-color": accentColor } as React.CSSProperties}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      required
                      placeholder="your@email.com"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none bg-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      placeholder="Your phone number"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Event Date</label>
                    <input
                      type="date"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                  <select className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none bg-white">
                    <option value="">Select event type...</option>
                    <option>Birthday Party</option>
                    <option>Wedding</option>
                    <option>Baby Shower</option>
                    <option>Corporate Event</option>
                    <option>Grand Opening</option>
                    <option>Anniversary</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tell us more</label>
                  <textarea
                    rows={3}
                    placeholder="Describe your event, venue, colour scheme, any special requests..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none resize-none bg-white"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full text-white font-semibold rounded-xl py-3 text-sm transition-all hover:opacity-90"
                  style={{ backgroundColor: accentColor }}
                >
                  Request a Quote
                </button>
              </form>
            </div>
          </section>
        )}
      </div>

      {/* Powered by footer */}
      <div className="text-center py-6 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Powered by{" "}
          <a
            href="/"
            className="font-semibold hover:underline"
            style={{ color: accentColor }}
          >
            🎈 BalloonBase
          </a>
        </p>
      </div>
    </div>
  );
}
