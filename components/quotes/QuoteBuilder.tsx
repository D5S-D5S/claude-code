"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronLeft,
  User,
  Layers,
  ShoppingBag,
  FileText,
  Check,
  Plus,
  Minus,
  Loader2,
  Ruler,
  Zap,
  Star,
  Crown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  formatCurrency,
  feetToMeters,
  metersToFeet,
  calculateQuoteTotal,
} from "@/lib/utils";
import {
  Profile,
  PricingTier,
  Customer,
  Package,
  Addon,
  QuoteAddon,
} from "@/types";

const STEPS = [
  { id: 1, label: "Client Details", icon: User },
  { id: 2, label: "Service & Tier", icon: Layers },
  { id: 3, label: "Add-ons & Fees", icon: ShoppingBag },
  { id: 4, label: "Review & Send", icon: FileText },
];

const EVENT_TYPES = [
  "Birthday Party",
  "Wedding",
  "Baby Shower",
  "Corporate Event",
  "Grand Opening",
  "Anniversary",
  "Quinceañera",
  "Graduation",
  "Bridal Shower",
  "Gender Reveal",
  "Other",
];

const TIER_ICONS = [Zap, Star, Crown];
const TIER_COLORS = [
  { bg: "bg-gray-50", border: "border-gray-200", badge: "bg-gray-100 text-gray-600", active: "border-orange-500 bg-orange-50" },
  { bg: "bg-orange-50", border: "border-orange-200", badge: "bg-orange-100 text-orange-700", active: "border-orange-500 bg-orange-50" },
  { bg: "bg-purple-50", border: "border-purple-200", badge: "bg-purple-100 text-purple-700", active: "border-purple-500 bg-purple-50" },
];

interface QuoteBuilderProps {
  profile: Profile | null;
  pricingTiers: PricingTier[];
  customers: Pick<Customer, "id" | "name" | "email" | "phone">[];
  packages: Package[];
  addons: Addon[];
}

export default function QuoteBuilder({
  profile,
  pricingTiers,
  customers,
  packages,
  addons,
}: QuoteBuilderProps) {
  const router = useRouter();
  const supabase = createClient();

  const currency = profile?.currency || "GBP";
  const symbol = profile?.currency_symbol || "£";
  const platformFeePercent = profile?.platform_fee_percent || 2;
  const passFeeToCust = profile?.pass_fee_to_customer || false;

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Client
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("new");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventAddress, setEventAddress] = useState("");
  const [notes, setNotes] = useState("");

  // Step 2: Service & Tier
  const [selectedTierId, setSelectedTierId] = useState(
    pricingTiers[1]?.id || pricingTiers[0]?.id || ""
  );
  const [unitPref, setUnitPref] = useState<"feet" | "meters">("feet");
  const [lengthInput, setLengthInput] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("");

  // Step 3: Add-ons & Fees
  const [selectedAddons, setSelectedAddons] = useState<
    Record<string, { addon: Addon; qty: number }>
  >({});
  const [deliveryType, setDeliveryType] = useState<"none" | "flat" | "distance">("none");
  const [deliveryFlat, setDeliveryFlat] = useState("");
  const [deliveryDistance, setDeliveryDistance] = useState("");
  const [deliveryPerMile, setDeliveryPerMile] = useState("");
  const [rushFeePercent, setRushFeePercent] = useState("");
  const [discountType, setDiscountType] = useState<"none" | "amount" | "percent">("none");
  const [discountValue, setDiscountValue] = useState("");
  const [couponCode, setCouponCode] = useState("");

  // Computed values
  const selectedTier = pricingTiers.find((t) => t.id === selectedTierId);
  const lengthFeet = useMemo(() => {
    const val = parseFloat(lengthInput) || 0;
    return unitPref === "feet" ? val : metersToFeet(val);
  }, [lengthInput, unitPref]);
  const lengthMeters = useMemo(() => feetToMeters(lengthFeet), [lengthFeet]);

  const addonTotal = useMemo(() => {
    return Object.values(selectedAddons).reduce(
      (sum, { addon, qty }) => sum + addon.price * qty,
      0
    );
  }, [selectedAddons]);

  const selectedPackage = packages.find((p) => p.id === selectedPackageId);
  const packagePrice = selectedPackage?.price || 0;
  const deliveryFee =
    deliveryType === "flat"
      ? parseFloat(deliveryFlat) || 0
      : deliveryType === "distance"
      ? (parseFloat(deliveryDistance) || 0) * (parseFloat(deliveryPerMile) || 0)
      : 0;

  const garlandSubtotal = (selectedTier?.price_per_foot || 0) * lengthFeet;
  const rushFeeAmt = (garlandSubtotal * (parseFloat(rushFeePercent) || 0)) / 100;

  const { subtotal, discountValue: discountAmt, platformFee, total } = useMemo(
    () =>
      calculateQuoteTotal({
        tierPricePerFoot: selectedTier?.price_per_foot || 0,
        lengthFeet,
        addonTotal,
        packagePrice,
        deliveryFee,
        rushFee: rushFeeAmt,
        discountAmount: discountType === "amount" ? parseFloat(discountValue) || 0 : 0,
        discountPercent: discountType === "percent" ? parseFloat(discountValue) || 0 : 0,
        platformFeePercent: passFeeToCust ? platformFeePercent : 0,
        passFeeToCust,
      }),
    [
      selectedTier,
      lengthFeet,
      addonTotal,
      packagePrice,
      deliveryFee,
      rushFeeAmt,
      discountType,
      discountValue,
      platformFeePercent,
      passFeeToCust,
    ]
  );

  function toggleAddon(addon: Addon) {
    setSelectedAddons((prev) => {
      if (prev[addon.id]) {
        const next = { ...prev };
        delete next[addon.id];
        return next;
      }
      return { ...prev, [addon.id]: { addon, qty: 1 } };
    });
  }

  function adjustAddonQty(addonId: string, delta: number) {
    setSelectedAddons((prev) => {
      const current = prev[addonId];
      if (!current) return prev;
      const newQty = current.qty + delta;
      if (newQty <= 0) {
        const next = { ...prev };
        delete next[addonId];
        return next;
      }
      return { ...prev, [addonId]: { ...current, qty: newQty } };
    });
  }

  async function handleSave(sendNow = false) {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let customerId = selectedCustomerId || null;

      // Create new customer if needed
      if (customerMode === "new" && clientName) {
        const { data: newCustomer, error: custErr } = await supabase
          .from("customers")
          .insert({
            profile_id: user.id,
            name: clientName,
            email: clientEmail || null,
            phone: clientPhone || null,
          })
          .select()
          .single();

        if (custErr) throw custErr;
        customerId = newCustomer.id;
      }

      const addonsSelected: QuoteAddon[] = Object.values(selectedAddons).map(
        ({ addon, qty }) => ({
          id: addon.id,
          name: addon.name,
          price: addon.price,
          quantity: qty,
        })
      );

      const { data: quote, error: quoteErr } = await supabase
        .from("quotes")
        .insert({
          profile_id: user.id,
          customer_id: customerId,
          status: sendNow ? "sent" : "draft",
          event_type: eventType || null,
          event_date: eventDate || null,
          event_address: eventAddress || null,
          tier_id: selectedTierId || null,
          length_feet: lengthFeet || null,
          length_meters: lengthMeters || null,
          unit_preference: unitPref,
          subtotal,
          package_id: selectedPackageId || null,
          addons_selected: addonsSelected,
          delivery_type: deliveryType,
          delivery_flat_fee: deliveryType === "flat" ? parseFloat(deliveryFlat) || 0 : 0,
          delivery_distance: deliveryType === "distance" ? parseFloat(deliveryDistance) || 0 : 0,
          delivery_per_mile: deliveryType === "distance" ? parseFloat(deliveryPerMile) || 0 : 0,
          rush_fee: rushFeeAmt,
          rush_fee_percent: parseFloat(rushFeePercent) || 0,
          discount_amount: discountType === "amount" ? parseFloat(discountValue) || 0 : 0,
          discount_percent: discountType === "percent" ? parseFloat(discountValue) || 0 : 0,
          coupon_code: couponCode || null,
          platform_fee_percent: platformFeePercent,
          platform_fee_amount: platformFee,
          pass_fee_to_customer: passFeeToCust,
          total,
          notes: notes || null,
          sent_at: sendNow ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (quoteErr) throw quoteErr;

      router.push(`/quotes/${quote.id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to save quote. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">New Quote</h1>
        <p className="text-gray-500 text-sm mt-1">Build and send a professional quote</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, idx) => {
          const Icon = s.icon;
          const isActive = s.id === step;
          const isDone = s.id < step;

          return (
            <div key={s.id} className="flex items-center gap-2">
              <button
                onClick={() => isDone && setStep(s.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-orange-500 text-white shadow-sm"
                    : isDone
                    ? "bg-green-100 text-green-700 cursor-pointer hover:bg-green-200"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {isDone ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                <span className="hidden sm:block">{s.label}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-gray-300" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        {/* STEP 1: Client Details */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Client Details</h2>

            {customers.length > 0 && (
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setCustomerMode("new")}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    customerMode === "new"
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  New customer
                </button>
                <button
                  onClick={() => setCustomerMode("existing")}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    customerMode === "existing"
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Existing customer
                </button>
              </div>
            )}

            {customerMode === "existing" ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Customer
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">Choose a customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.email ? `(${c.email})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Field
                  label="Client Name *"
                  value={clientName}
                  onChange={setClientName}
                  placeholder="Sarah Jones"
                />
                <Field
                  label="Email"
                  type="email"
                  value={clientEmail}
                  onChange={setClientEmail}
                  placeholder="sarah@email.com"
                />
                <Field
                  label="Phone"
                  type="tel"
                  value={clientPhone}
                  onChange={setClientPhone}
                  placeholder="+44 7700 000000"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">Select event type...</option>
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <Field
                label="Event Date"
                type="date"
                value={eventDate}
                onChange={setEventDate}
              />
            </div>

            <Field
              label="Event Address"
              value={eventAddress}
              onChange={setEventAddress}
              placeholder="123 Party Street, London, SW1A 1AA"
            />

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requirements or notes..."
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>
          </div>
        )}

        {/* STEP 2: Service & Tier */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Service & Pricing Tier</h2>

            {/* Unit preference */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm font-medium text-gray-700">Measure in:</span>
              <div className="flex gap-2">
                {(["feet", "meters"] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => {
                      if (lengthInput) {
                        const val = parseFloat(lengthInput) || 0;
                        if (u === "meters" && unitPref === "feet") {
                          setLengthInput(String(feetToMeters(val)));
                        } else if (u === "feet" && unitPref === "meters") {
                          setLengthInput(String(metersToFeet(val)));
                        }
                      }
                      setUnitPref(u);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      unitPref === u
                        ? "bg-orange-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Ruler className="w-3.5 h-3.5" />
                    {u === "feet" ? "Feet" : "Meters"}
                  </button>
                ))}
              </div>
            </div>

            {/* Length input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Balloon Length ({unitPref})
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={lengthInput}
                  onChange={(e) => setLengthInput(e.target.value)}
                  placeholder={unitPref === "feet" ? "e.g. 20" : "e.g. 6"}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-16 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                  {unitPref}
                </span>
              </div>
              {lengthFeet > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  ≈ {unitPref === "feet" ? `${lengthMeters}m` : `${lengthFeet}ft`}
                </p>
              )}
            </div>

            {/* Tier selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Pricing Tier
              </label>
              {pricingTiers.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <p className="text-gray-500 text-sm">No pricing tiers configured.</p>
                  <a href="/settings" className="text-orange-500 text-sm font-medium">
                    Set up tiers in Settings →
                  </a>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {pricingTiers.map((tier, idx) => {
                    const colors = TIER_COLORS[idx] || TIER_COLORS[0];
                    const TierIcon = TIER_ICONS[idx] || TIER_ICONS[0];
                    const isSelected = tier.id === selectedTierId;
                    const tierCost = (tier.price_per_foot || 0) * lengthFeet;

                    return (
                      <button
                        key={tier.id}
                        onClick={() => setSelectedTierId(tier.id)}
                        className={`relative p-4 rounded-2xl border-2 text-left transition-all ${
                          isSelected
                            ? `border-orange-500 bg-orange-50`
                            : `${colors.border} ${colors.bg} hover:border-orange-300`
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-2">
                          <TierIcon className="w-4 h-4 text-orange-500" />
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
                            Tier {tier.tier_number}
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-900 text-sm mb-1">{tier.name}</h3>
                        {tier.description && (
                          <p className="text-xs text-gray-500 mb-3">{tier.description}</p>
                        )}
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-gray-900">
                            {symbol}{tier.price_per_foot}/ft
                          </p>
                          <p className="text-xs text-gray-400">
                            ({symbol}{tier.price_per_meter}/m)
                          </p>
                          {lengthFeet > 0 && (
                            <p className="text-base font-bold text-orange-600 mt-2">
                              = {formatCurrency(tierCost, currency, symbol)}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Optional package */}
            {packages.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add a Package (optional)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedPackageId("")}
                    className={`p-3 rounded-xl border-2 text-left text-sm transition-all ${
                      !selectedPackageId
                        ? "border-orange-500 bg-orange-50 text-orange-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    No package
                  </button>
                  {packages.map((pkg) => (
                    <button
                      key={pkg.id}
                      onClick={() =>
                        setSelectedPackageId(
                          selectedPackageId === pkg.id ? "" : pkg.id
                        )
                      }
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        selectedPackageId === pkg.id
                          ? "border-orange-500 bg-orange-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">{pkg.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{pkg.description}</p>
                      <p className="text-sm font-bold text-orange-600 mt-1">
                        +{formatCurrency(pkg.price, currency, symbol)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Add-ons & Fees */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add-ons & Fees</h2>

            {/* Add-ons */}
            {addons.length > 0 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Add-ons</label>
                <div className="grid grid-cols-2 gap-3">
                  {addons.map((addon) => {
                    const selected = selectedAddons[addon.id];
                    return (
                      <div
                        key={addon.id}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          selected
                            ? "border-orange-500 bg-orange-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{addon.name}</p>
                            <p className="text-xs text-orange-600 font-medium">
                              {formatCurrency(addon.price, currency, symbol)}/{addon.unit === "item" ? "ea" : addon.unit}
                            </p>
                          </div>
                          {selected ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => adjustAddonQty(addon.id, -1)}
                                className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center hover:bg-orange-200 transition-all"
                              >
                                <Minus className="w-3 h-3 text-orange-600" />
                              </button>
                              <span className="text-sm font-bold text-orange-600 w-5 text-center">
                                {selected.qty}
                              </span>
                              <button
                                onClick={() => adjustAddonQty(addon.id, 1)}
                                className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center hover:bg-orange-200 transition-all"
                              >
                                <Plus className="w-3 h-3 text-orange-600" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => toggleAddon(addon)}
                              className="w-7 h-7 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-orange-400 hover:bg-orange-50 transition-all"
                            >
                              <Plus className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Delivery */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Delivery</label>
              <div className="flex gap-2 mb-3">
                {(["none", "flat", "distance"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDeliveryType(d)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      deliveryType === d
                        ? "bg-orange-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {d === "none" ? "No delivery" : d === "flat" ? "Flat fee" : "By distance"}
                  </button>
                ))}
              </div>
              {deliveryType === "flat" && (
                <Field
                  label={`Delivery fee (${symbol})`}
                  type="number"
                  value={deliveryFlat}
                  onChange={setDeliveryFlat}
                  placeholder="25"
                />
              )}
              {deliveryType === "distance" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Distance (miles)"
                    type="number"
                    value={deliveryDistance}
                    onChange={setDeliveryDistance}
                    placeholder="10"
                  />
                  <Field
                    label={`Rate per mile (${symbol})`}
                    type="number"
                    value={deliveryPerMile}
                    onChange={setDeliveryPerMile}
                    placeholder="0.45"
                  />
                </div>
              )}
            </div>

            {/* Rush fee */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Rush Fee (%)</label>
              <div className="flex gap-2">
                {["0", "10", "15", "20", "25"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setRushFeePercent(v === "0" ? "" : v)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      (rushFeePercent === v || (v === "0" && !rushFeePercent))
                        ? "bg-orange-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {v === "0" ? "None" : `+${v}%`}
                  </button>
                ))}
                <input
                  type="number"
                  value={rushFeePercent}
                  onChange={(e) => setRushFeePercent(e.target.value)}
                  placeholder="Custom %"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>

            {/* Discount */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Discount</label>
              <div className="flex gap-2 mb-3">
                {(["none", "amount", "percent"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDiscountType(d)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      discountType === d
                        ? "bg-orange-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {d === "none" ? "No discount" : d === "amount" ? `Fixed (${symbol})` : "Percent (%)"}
                  </button>
                ))}
              </div>
              {discountType !== "none" && (
                <Field
                  label={discountType === "amount" ? `Discount amount (${symbol})` : "Discount percent (%)"}
                  type="number"
                  value={discountValue}
                  onChange={setDiscountValue}
                  placeholder={discountType === "amount" ? "20" : "10"}
                />
              )}
            </div>

            {/* Coupon */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Coupon Code (optional)</label>
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="SUMMER20"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 uppercase"
              />
            </div>
          </div>
        )}

        {/* STEP 4: Review & Send */}
        {step === 4 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Review Quote</h2>

            {/* Client info */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Client</h3>
              <p className="text-sm font-semibold text-gray-900">
                {customerMode === "existing"
                  ? customers.find((c) => c.id === selectedCustomerId)?.name || "—"
                  : clientName || "—"}
              </p>
              <p className="text-xs text-gray-500">
                {eventType && <span>{eventType}</span>}
                {eventDate && <span> · {new Date(eventDate).toLocaleDateString("en-GB")}</span>}
              </p>
            </div>

            {/* Price breakdown */}
            <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Price Breakdown</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {selectedTier && lengthFeet > 0 && (
                  <LineItem
                    label={`${selectedTier.name} (Tier ${selectedTier.tier_number}) — ${lengthFeet} ft`}
                    value={formatCurrency((selectedTier.price_per_foot || 0) * lengthFeet, currency, symbol)}
                  />
                )}
                {selectedPackage && (
                  <LineItem label={selectedPackage.name} value={formatCurrency(selectedPackage.price, currency, symbol)} />
                )}
                {Object.values(selectedAddons).map(({ addon, qty }) => (
                  <LineItem
                    key={addon.id}
                    label={`${addon.name} × ${qty}`}
                    value={formatCurrency(addon.price * qty, currency, symbol)}
                  />
                ))}
                {deliveryFee > 0 && (
                  <LineItem
                    label={deliveryType === "flat" ? "Delivery (flat)" : `Delivery (${deliveryDistance} miles)`}
                    value={formatCurrency(deliveryFee, currency, symbol)}
                  />
                )}
                {rushFeeAmt > 0 && (
                  <LineItem label={`Rush fee (${rushFeePercent}%)`} value={formatCurrency(rushFeeAmt, currency, symbol)} />
                )}
                {discountAmt > 0 && (
                  <LineItem
                    label={`Discount ${discountType === "percent" ? `(${discountValue}%)` : ""}`}
                    value={`-${formatCurrency(discountAmt, currency, symbol)}`}
                    isDiscount
                  />
                )}
                {platformFee > 0 && passFeeToCust && (
                  <LineItem label={`Platform fee (${platformFeePercent}%)`} value={formatCurrency(platformFee, currency, symbol)} />
                )}
              </div>
              <div className="bg-orange-50 px-4 py-3 flex items-center justify-between border-t border-orange-100">
                <span className="font-bold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-orange-600">
                  {formatCurrency(total, currency, symbol)}
                </span>
              </div>
            </div>

            {!passFeeToCust && platformFeePercent > 0 && (
              <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 mb-4">
                Platform fee ({platformFeePercent}% = {formatCurrency((total * platformFeePercent) / 100, currency, symbol)}) is absorbed by you and not shown to the customer.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {step < 4 ? (
          <button
            onClick={() => setStep((s) => Math.min(4, s + 1))}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-all"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl px-4 py-2.5 text-sm transition-all disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save as Draft
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-all disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Send Quote
            </button>
          </div>
        )}
      </div>

      {/* Live price preview (floating) */}
      {(step === 2 || step === 3) && total > 0 && (
        <div className="fixed bottom-6 right-6 bg-white border border-gray-200 rounded-2xl shadow-xl px-5 py-3 flex items-center gap-3">
          <div>
            <p className="text-xs text-gray-400">Estimated total</p>
            <p className="text-xl font-bold text-orange-600">
              {formatCurrency(total, currency, symbol)}
            </p>
          </div>
        </div>
      )}
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
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
      />
    </div>
  );
}

function LineItem({
  label,
  value,
  isDiscount,
}: {
  label: string;
  value: string;
  isDiscount?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-semibold ${isDiscount ? "text-green-600" : "text-gray-900"}`}>
        {value}
      </span>
    </div>
  );
}
