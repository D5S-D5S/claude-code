export type Plan = "starter" | "pro" | "enterprise";

export type Currency = {
  code: string;
  symbol: string;
  name: string;
};

export const CURRENCIES: Currency[] = [
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
];

export type Profile = {
  id: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  currency: string;
  currency_symbol: string;
  logo_url: string | null;
  stripe_account_id: string | null;
  stripe_connected: boolean;
  platform_fee_percent: number;
  pass_fee_to_customer: boolean;
  plan: Plan;
  created_at: string;
  updated_at: string;
};

export type PricingTier = {
  id: string;
  profile_id: string;
  tier_number: 1 | 2 | 3;
  name: string;
  description: string | null;
  price_per_foot: number;
  price_per_meter: number;
  color: string;
  is_active: boolean;
  created_at: string;
};

export type Customer = {
  id: string;
  profile_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  total_spent: number;
  quotes_count: number;
  created_at: string;
  updated_at: string;
};

export type Package = {
  id: string;
  profile_id: string;
  name: string;
  description: string | null;
  price: number;
  items: PackageItem[];
  is_active: boolean;
  created_at: string;
};

export type PackageItem = {
  name: string;
  quantity: number;
};

export type Addon = {
  id: string;
  profile_id: string;
  name: string;
  price: number;
  unit: "item" | "per_foot" | "per_meter";
  is_active: boolean;
  created_at: string;
};

export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "approved"
  | "rejected"
  | "expired"
  | "paid";

export type DeliveryType = "none" | "flat" | "distance";

export type QuoteAddon = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

export type Quote = {
  id: string;
  profile_id: string;
  customer_id: string | null;
  quote_number: string;
  status: QuoteStatus;
  event_type: string | null;
  event_date: string | null;
  event_address: string | null;
  tier_id: string | null;
  length_feet: number | null;
  length_meters: number | null;
  unit_preference: "feet" | "meters";
  subtotal: number;
  package_id: string | null;
  addons_selected: QuoteAddon[];
  delivery_type: DeliveryType;
  delivery_flat_fee: number;
  delivery_distance: number;
  delivery_per_mile: number;
  rush_fee: number;
  rush_fee_percent: number;
  discount_amount: number;
  discount_percent: number;
  coupon_code: string | null;
  platform_fee_percent: number;
  platform_fee_amount: number;
  pass_fee_to_customer: boolean;
  total: number;
  payment_status: "unpaid" | "partial" | "paid";
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  paid_at: string | null;
  ai_estimate_used: boolean;
  ai_confidence: number | null;
  ai_image_url: string | null;
  notes: string | null;
  internal_notes: string | null;
  sent_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  customer?: Customer;
  tier?: PricingTier;
};

export type Job = {
  id: string;
  profile_id: string;
  quote_id: string | null;
  customer_id: string | null;
  title: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  end_time: string | null;
  duration_hours: number | null;
  address: string | null;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  team_notes: string | null;
  created_at: string;
  // Joined
  customer?: Customer;
  quote?: Quote;
};

export type InventoryItem = {
  id: string;
  profile_id: string;
  name: string;
  category: string | null;
  color: string | null;
  size: string | null;
  quantity_in_stock: number;
  low_stock_threshold: number;
  unit_cost: number | null;
  supplier: string | null;
  sku: string | null;
  created_at: string;
  updated_at: string;
};

export type StorefrontSettings = {
  id: string;
  profile_id: string;
  slug: string;
  headline: string | null;
  tagline: string | null;
  banner_image_url: string | null;
  accent_color: string;
  show_packages: boolean;
  show_contact_form: boolean;
  is_published: boolean;
  created_at: string;
};

export type AIEstimateResult = {
  length_feet: number;
  length_meters: number;
  confidence: number;
  description: string;
  suggestions: string[];
};
