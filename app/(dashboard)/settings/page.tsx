"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Save,
  Loader2,
  Building2,
  CreditCard,
  Palette,
  Bell,
  Zap,
  Star,
  Crown,
  Check,
} from "lucide-react";
import { CURRENCIES } from "@/types";
import { feetToMeters } from "@/lib/utils";

const TIER_ICONS = [Zap, Star, Crown];
const TIER_COLORS = ["#6B7280", "#F97316", "#7C3AED"];
const TIER_DEFAULTS = [
  { name: "Classic", description: "Standard balloon garland, elegant and minimal" },
  { name: "Premier", description: "Includes 5\" accent balloons, fuller look" },
  { name: "Grand Gala", description: "Wide arch with premium mix, statement pieces" },
];

interface PricingTierForm {
  id: string;
  name: string;
  description: string;
  price_per_foot: string;
  price_per_meter: string;
  tier_number: number;
}

export default function SettingsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [tiers, setTiers] = useState<PricingTierForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("business");

  // Profile form
  const [form, setForm] = useState({
    business_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    currency: "GBP",
    platform_fee_percent: "2",
    pass_fee_to_customer: false,
  });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: p }, { data: t }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("pricing_tiers").select("*").eq("profile_id", user.id).order("tier_number"),
      ]);

      if (p) {
        setProfile(p);
        setForm({
          business_name: p.business_name || "",
          email: p.email || "",
          phone: p.phone || "",
          address: p.address || "",
          city: p.city || "",
          country: p.country || "",
          currency: p.currency || "GBP",
          platform_fee_percent: String(p.platform_fee_percent || 2),
          pass_fee_to_customer: p.pass_fee_to_customer || false,
        });
      }

      if (t) {
        setTiers(
          t.map((tier: { id: string; name: string; description: string; price_per_foot: number; price_per_meter: number; tier_number: number }) => ({
            id: tier.id,
            name: tier.name,
            description: tier.description || "",
            price_per_foot: String(tier.price_per_foot),
            price_per_meter: String(tier.price_per_meter),
            tier_number: tier.tier_number,
          }))
        );
      }

      setLoading(false);
    }
    load();
  }, []);

  function handleTierChange(idx: number, field: keyof PricingTierForm, value: string) {
    setTiers((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      // Auto-convert between feet and meters
      if (field === "price_per_foot") {
        const footRate = parseFloat(value) || 0;
        next[idx].price_per_meter = footRate > 0 ? String(Math.round(footRate * 3.28084 * 100) / 100) : "";
      } else if (field === "price_per_meter") {
        const meterRate = parseFloat(value) || 0;
        next[idx].price_per_foot = meterRate > 0 ? String(Math.round(meterRate / 3.28084 * 100) / 100) : "";
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const selectedCurrency = CURRENCIES.find((c) => c.code === form.currency);

    // Save profile
    await supabase.from("profiles").update({
      business_name: form.business_name,
      email: form.email,
      phone: form.phone,
      address: form.address,
      city: form.city,
      country: form.country,
      currency: form.currency,
      currency_symbol: selectedCurrency?.symbol || "£",
      platform_fee_percent: parseFloat(form.platform_fee_percent) || 2,
      pass_fee_to_customer: form.pass_fee_to_customer,
    }).eq("id", user.id);

    // Save pricing tiers
    for (const tier of tiers) {
      await supabase.from("pricing_tiers").update({
        name: tier.name,
        description: tier.description,
        price_per_foot: parseFloat(tier.price_per_foot) || 0,
        price_per_meter: parseFloat(tier.price_per_meter) || 0,
      }).eq("id", tier.id);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const TABS = [
    { id: "business", label: "Business Info", icon: Building2 },
    { id: "pricing", label: "Pricing Tiers", icon: CreditCard },
    { id: "platform", label: "Platform & Fees", icon: Palette },
    { id: "automations", label: "Automations", icon: Bell },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Configure your business and pricing</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-all disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      <div className="flex gap-6">
        {/* Tab nav */}
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                    activeTab === tab.id
                      ? "bg-orange-50 text-orange-600"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${activeTab === tab.id ? "text-orange-500" : "text-gray-400"}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab content */}
        <div className="flex-1 space-y-4">
          {/* Business Info */}
          {activeTab === "business" && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="font-bold text-gray-900 mb-4">Business Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Business Name"
                  value={form.business_name}
                  onChange={(v) => setForm((f) => ({ ...f, business_name: v }))}
                  placeholder="Sarah's Balloon Studio"
                />
                <Field
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                  placeholder="hello@mybusiness.com"
                />
                <Field
                  label="Phone"
                  type="tel"
                  value={form.phone}
                  onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                  placeholder="+44 7700 000000"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.symbol} {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Field
                  label="Address"
                  value={form.address}
                  onChange={(v) => setForm((f) => ({ ...f, address: v }))}
                  placeholder="123 Business Road"
                />
                <Field
                  label="City"
                  value={form.city}
                  onChange={(v) => setForm((f) => ({ ...f, city: v }))}
                  placeholder="London"
                />
                <Field
                  label="Country"
                  value={form.country}
                  onChange={(v) => setForm((f) => ({ ...f, country: v }))}
                  placeholder="United Kingdom"
                />
              </div>
            </div>
          )}

          {/* Pricing Tiers */}
          {activeTab === "pricing" && (
            <div className="space-y-4">
              {tiers.map((tier, idx) => {
                const Icon = TIER_ICONS[idx] || TIER_ICONS[0];
                return (
                  <div key={tier.id} className="bg-white rounded-2xl border border-gray-100 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: TIER_COLORS[idx] + "20" }}
                      >
                        <Icon className="w-5 h-5" style={{ color: TIER_COLORS[idx] }} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">Tier {tier.tier_number}</h3>
                        <p className="text-xs text-gray-400">Pricing level {tier.tier_number} of 3</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field
                        label="Tier Name"
                        value={tier.name}
                        onChange={(v) => handleTierChange(idx, "name", v)}
                        placeholder={TIER_DEFAULTS[idx]?.name}
                      />
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <input
                          value={tier.description}
                          onChange={(e) => handleTierChange(idx, "description", e.target.value)}
                          placeholder={TIER_DEFAULTS[idx]?.description}
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Price per Foot ({CURRENCIES.find((c) => c.code === form.currency)?.symbol})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={tier.price_per_foot}
                          onChange={(e) => handleTierChange(idx, "price_per_foot", e.target.value)}
                          placeholder="40"
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          ≈ {CURRENCIES.find((c) => c.code === form.currency)?.symbol}
                          {tier.price_per_meter || "0"}/meter
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Price per Meter ({CURRENCIES.find((c) => c.code === form.currency)?.symbol})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={tier.price_per_meter}
                          onChange={(e) => handleTierChange(idx, "price_per_meter", e.target.value)}
                          placeholder="131"
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          ≈ {CURRENCIES.find((c) => c.code === form.currency)?.symbol}
                          {tier.price_per_foot || "0"}/foot
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Platform & Fees */}
          {activeTab === "platform" && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="font-bold text-gray-900 mb-4">Platform Fee Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Platform Fee Percentage
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="20"
                      step="0.5"
                      value={form.platform_fee_percent}
                      onChange={(e) => setForm((f) => ({ ...f, platform_fee_percent: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    This % is taken from every payment processed through Balloon Base.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <div className="relative mt-0.5">
                      <input
                        type="checkbox"
                        checked={form.pass_fee_to_customer}
                        onChange={(e) => setForm((f) => ({ ...f, pass_fee_to_customer: e.target.checked }))}
                        className="sr-only"
                      />
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          form.pass_fee_to_customer
                            ? "bg-orange-500 border-orange-500"
                            : "border-gray-300"
                        }`}
                        onClick={() =>
                          setForm((f) => ({ ...f, pass_fee_to_customer: !f.pass_fee_to_customer }))
                        }
                      >
                        {form.pass_fee_to_customer && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Pass fee to customer</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        If enabled, the platform fee is added to the customer&apos;s invoice total.
                        If disabled, you absorb the fee from your earnings.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="bg-orange-50 rounded-xl p-4">
                  <p className="text-sm font-semibold text-orange-800 mb-1">Example</p>
                  <p className="text-xs text-orange-600">
                    On a {CURRENCIES.find((c) => c.code === form.currency)?.symbol}1,000 job with{" "}
                    {form.platform_fee_percent}% platform fee:{" "}
                    <strong>
                      {CURRENCIES.find((c) => c.code === form.currency)?.symbol}
                      {((1000 * parseFloat(form.platform_fee_percent || "2")) / 100).toFixed(2)}
                    </strong>{" "}
                    goes to Balloon Base.{" "}
                    {form.pass_fee_to_customer
                      ? `Customer pays ${CURRENCIES.find((c) => c.code === form.currency)?.symbol}${(1000 + (1000 * parseFloat(form.platform_fee_percent || "2")) / 100).toFixed(2)}.`
                      : `You receive ${CURRENCIES.find((c) => c.code === form.currency)?.symbol}${(1000 - (1000 * parseFloat(form.platform_fee_percent || "2")) / 100).toFixed(2)}.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Automations */}
          {activeTab === "automations" && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="font-bold text-gray-900 mb-1">Email Automations</h2>
              <p className="text-sm text-gray-500 mb-4">
                Automatically send emails to customers when key events happen.
              </p>
              <div className="space-y-3">
                {[
                  {
                    trigger: "Quote Sent",
                    desc: "Send quote PDF to customer when you mark as sent",
                    enabled: true,
                  },
                  {
                    trigger: "Payment Received",
                    desc: "Send receipt when payment is confirmed",
                    enabled: true,
                  },
                  {
                    trigger: "Job Reminder (24h)",
                    desc: "Remind customer 24 hours before their install",
                    enabled: false,
                  },
                  {
                    trigger: "Follow-up (3 days)",
                    desc: "Ask for review 3 days after job completion",
                    enabled: false,
                  },
                ].map((auto) => (
                  <div
                    key={auto.trigger}
                    className="flex items-start justify-between p-4 rounded-xl bg-gray-50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{auto.trigger}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{auto.desc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!auto.enabled && (
                        <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded-full">
                          Pro
                        </span>
                      )}
                      <div
                        className={`w-10 h-5 rounded-full relative cursor-pointer transition-all ${
                          auto.enabled ? "bg-orange-500" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${
                            auto.enabled ? "left-5" : "left-0.5"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-xl">
                <p className="text-sm font-semibold text-blue-800 mb-1">Email Sender</p>
                <p className="text-xs text-blue-600 mb-2">
                  Emails are sent from <strong>hello@balloonbase.io</strong> on your behalf.
                  Pro users can configure a custom sending domain.
                </p>
                <a
                  href="/settings/storefront"
                  className="text-xs text-blue-700 font-semibold underline"
                >
                  Configure custom domain →
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
      />
    </div>
  );
}
