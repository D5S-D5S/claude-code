-- BalloonBase Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ================================================================
-- PROFILES (business owner settings)
-- ================================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  business_name text,
  email text,
  phone text,
  address text,
  city text,
  country text,
  currency text default 'GBP',
  currency_symbol text default '£',
  logo_url text,
  stripe_account_id text,
  stripe_connected boolean default false,
  platform_fee_percent numeric(5,2) default 2.00,
  pass_fee_to_customer boolean default false,
  plan text default 'starter' check (plan in ('starter', 'pro', 'enterprise')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- ================================================================
-- PRICING TIERS
-- ================================================================
create table public.pricing_tiers (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  tier_number int not null check (tier_number in (1, 2, 3)),
  name text not null,
  description text,
  price_per_foot numeric(10,2) not null default 0,
  price_per_meter numeric(10,2) not null default 0,
  color text default '#F97316',
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (profile_id, tier_number)
);

alter table public.pricing_tiers enable row level security;
create policy "Users can manage own pricing tiers" on public.pricing_tiers for all using (
  profile_id = auth.uid()
);

-- ================================================================
-- CUSTOMERS (CRM)
-- ================================================================
create table public.customers (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  email text,
  phone text,
  address text,
  city text,
  notes text,
  total_spent numeric(10,2) default 0,
  quotes_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.customers enable row level security;
create policy "Users can manage own customers" on public.customers for all using (
  profile_id = auth.uid()
);

-- ================================================================
-- PACKAGES (pre-built bundles)
-- ================================================================
create table public.packages (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  price numeric(10,2) not null,
  items jsonb default '[]',
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.packages enable row level security;
create policy "Users can manage own packages" on public.packages for all using (
  profile_id = auth.uid()
);

-- ================================================================
-- ADD-ONS
-- ================================================================
create table public.addons (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  price numeric(10,2) not null,
  unit text default 'item' check (unit in ('item', 'per_foot', 'per_meter')),
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.addons enable row level security;
create policy "Users can manage own addons" on public.addons for all using (
  profile_id = auth.uid()
);

-- ================================================================
-- QUOTES
-- ================================================================
create table public.quotes (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  customer_id uuid references public.customers(id) on delete set null,
  quote_number text unique,
  status text default 'draft' check (status in ('draft','sent','viewed','approved','rejected','expired','paid')),
  event_type text,
  event_date date,
  event_address text,
  -- Pricing
  tier_id uuid references public.pricing_tiers(id) on delete set null,
  length_feet numeric(10,2),
  length_meters numeric(10,2),
  unit_preference text default 'feet' check (unit_preference in ('feet','meters')),
  subtotal numeric(10,2) default 0,
  -- Package
  package_id uuid references public.packages(id) on delete set null,
  -- Add-ons (JSON array of {id, name, price, quantity})
  addons_selected jsonb default '[]',
  -- Fees
  delivery_type text default 'none' check (delivery_type in ('none','flat','distance')),
  delivery_flat_fee numeric(10,2) default 0,
  delivery_distance numeric(10,2) default 0,
  delivery_per_mile numeric(10,2) default 0,
  rush_fee numeric(10,2) default 0,
  rush_fee_percent numeric(5,2) default 0,
  discount_amount numeric(10,2) default 0,
  discount_percent numeric(5,2) default 0,
  coupon_code text,
  -- Platform fee
  platform_fee_percent numeric(5,2) default 2.00,
  platform_fee_amount numeric(10,2) default 0,
  pass_fee_to_customer boolean default false,
  -- Total
  total numeric(10,2) default 0,
  -- Payment
  payment_status text default 'unpaid' check (payment_status in ('unpaid','partial','paid')),
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  paid_at timestamptz,
  -- AI
  ai_estimate_used boolean default false,
  ai_confidence numeric(5,2),
  ai_image_url text,
  -- Notes
  notes text,
  internal_notes text,
  -- Timestamps
  sent_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.quotes enable row level security;
create policy "Users can manage own quotes" on public.quotes for all using (
  profile_id = auth.uid()
);

-- Auto-generate quote number
create or replace function generate_quote_number()
returns trigger as $$
begin
  new.quote_number := 'BB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('quote_number_seq')::text, 4, '0');
  return new;
end;
$$ language plpgsql;

create sequence if not exists quote_number_seq start 1000;

create trigger set_quote_number
  before insert on public.quotes
  for each row
  when (new.quote_number is null)
  execute function generate_quote_number();

-- ================================================================
-- JOBS (scheduled installs)
-- ================================================================
create table public.jobs (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  quote_id uuid references public.quotes(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  title text,
  scheduled_date date,
  scheduled_time time,
  end_time time,
  duration_hours numeric(5,2),
  address text,
  status text default 'scheduled' check (status in ('scheduled','in_progress','completed','cancelled')),
  team_notes text,
  created_at timestamptz default now()
);

alter table public.jobs enable row level security;
create policy "Users can manage own jobs" on public.jobs for all using (
  profile_id = auth.uid()
);

-- ================================================================
-- INVENTORY
-- ================================================================
create table public.inventory (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  category text,
  color text,
  size text,
  quantity_in_stock int default 0,
  low_stock_threshold int default 10,
  unit_cost numeric(10,2),
  supplier text,
  sku text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.inventory enable row level security;
create policy "Users can manage own inventory" on public.inventory for all using (
  profile_id = auth.uid()
);

-- ================================================================
-- STOREFRONT SETTINGS
-- ================================================================
create table public.storefront_settings (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade unique not null,
  slug text unique not null,
  headline text,
  tagline text,
  banner_image_url text,
  accent_color text default '#F97316',
  show_packages boolean default true,
  show_contact_form boolean default true,
  is_published boolean default false,
  created_at timestamptz default now()
);

alter table public.storefront_settings enable row level security;
create policy "Users can manage own storefront" on public.storefront_settings for all using (
  profile_id = auth.uid()
);
create policy "Public can view published storefronts" on public.storefront_settings
  for select using (is_published = true);

-- ================================================================
-- AUTOMATIONS
-- ================================================================
create table public.automations (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  trigger text not null,
  action text not null,
  template text,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.automations enable row level security;
create policy "Users can manage own automations" on public.automations for all using (
  profile_id = auth.uid()
);

-- ================================================================
-- HELPER: Create default data on user signup
-- ================================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  -- Create profile
  insert into public.profiles (id, email, business_name)
  values (new.id, new.email, split_part(new.email, '@', 1));

  -- Create default pricing tiers
  insert into public.pricing_tiers (profile_id, tier_number, name, description, price_per_foot, price_per_meter, color)
  values
    (new.id, 1, 'Classic', 'Standard balloon garland, elegant and minimal', 40, 131, '#6B7280'),
    (new.id, 2, 'Premier', 'Includes 5" accent balloons, fuller look', 50, 164, '#F97316'),
    (new.id, 3, 'Grand Gala', 'Wide arch with premium mix, statement pieces', 65, 213, '#7C3AED');

  -- Create default add-ons
  insert into public.addons (profile_id, name, price, unit)
  values
    (new.id, 'Cake Stand', 15, 'item'),
    (new.id, 'LED Number', 25, 'item'),
    (new.id, 'Character Cutout', 30, 'item'),
    (new.id, 'Shimmer Wall', 75, 'item'),
    (new.id, 'Sailboard', 40, 'item'),
    (new.id, 'Foil Balloon Set', 20, 'item'),
    (new.id, 'Neon Sign', 85, 'item'),
    (new.id, 'Extra 5" Balloons', 8, 'per_foot');

  -- Create default storefront
  insert into public.storefront_settings (profile_id, slug, headline, tagline)
  values (new.id, replace(split_part(new.email, '@', 1), '.', '-'), 'Beautiful Balloon Decorations', 'Making your events unforgettable');

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ================================================================
-- UPDATED_AT trigger
-- ================================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at before update on public.profiles for each row execute function update_updated_at();
create trigger update_customers_updated_at before update on public.customers for each row execute function update_updated_at();
create trigger update_quotes_updated_at before update on public.quotes for each row execute function update_updated_at();
create trigger update_inventory_updated_at before update on public.inventory for each row execute function update_updated_at();
