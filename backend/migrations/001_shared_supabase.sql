-- FreshSource production migration for Supabase.
-- Includes RLS security fixes, key mapping corrections, and robust auditing.

create extension if not exists pgcrypto;

--------------------------------------------------------------------------------
-- 1. SCHEMAS & TABLES
--------------------------------------------------------------------------------

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users(id) on delete set null,
  phone text unique,
  name text not null,
  role text check (role in ('farmer', 'buyer', 'transporter')),
  region text,
  rating numeric(3,2) not null default 0 check (rating >= 0 and rating <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.farmers (
  user_id uuid primary key references public.users(id) on delete cascade,
  farm_name text,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buyers (
  user_id uuid primary key references public.users(id) on delete cascade,
  business_name text,
  preferred_region text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transporters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  vehicle_type text not null,
  capacity_kg numeric(12,2) not null check (capacity_kg > 0),
  coverage_area text not null,
  is_verified_agent boolean not null default false,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.users(id) on delete cascade,
  crop_type text not null,
  unit text not null default 'bags',
  quantity numeric(12,2) not null check (quantity >= 0),
  price_per_unit numeric(12,2) not null check (price_per_unit > 0),
  location text not null,
  freshness text,
  image_url text,
  expected_harvest_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  buyer_id uuid not null references public.users(id) on delete restrict,
  transporter_id uuid references public.users(id) on delete set null,
  quantity numeric(12,2) not null check (quantity > 0),
  total_price numeric(12,2) not null check (total_price >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'in_transit', 'delivered', 'completed', 'cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'processing', 'paid', 'failed', 'refunded')),
  transaction_id text unique,
  payment_date timestamptz,
  pickup_photo_url text,
  delivery_photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inbound_messages (
  id text primary key,
  sender text not null,
  body text not null,
  status text not null default 'queued',
  created_at timestamptz not null default now()
);

create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null check (status in ('pending', 'confirmed', 'in_transit', 'delivered', 'completed', 'cancelled')),
  changed_by uuid references public.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.transport_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  farmer_id uuid not null references public.users(id) on delete cascade,
  requested_transporter_id uuid references public.users(id) on delete set null,
  pickup_location text not null,
  pickup_date date not null,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users(id) on delete cascade,
  receiver_id uuid not null references public.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  content text not null check (length(trim(content)) > 0),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.users(id) on delete cascade,
  reviewed_id uuid not null references public.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (reviewer_id, reviewed_id, order_id)
);

create table if not exists public.buyer_alerts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'sms', 'email', 'in_app')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (buyer_id, listing_id, channel)
);

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  user_id uuid references public.users(id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_extraction_logs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.whatsapp_conversations(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  source_message text not null,
  provider text not null check (provider in ('openai', 'ollama', 'local_parser')),
  model text,
  extracted_payload jsonb,
  confidence numeric(4,3) check (confidence is null or confidence between 0 and 1),
  status text not null check (status in ('success', 'partial', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_records (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

--------------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS & TRIGGERS
--------------------------------------------------------------------------------

-- Helper to safely translate auth.uid() to public.users.id
create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where auth_id = auth.uid() limit 1;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare tbl text;
begin
  foreach tbl in array array['users','farmers','buyers','transporters','listings','orders','transport_requests','whatsapp_conversations'] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', tbl, tbl);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', tbl, tbl);
  end loop;
end $$;

-- Fixed audit logger with safe JSON key extraction
create or replace function public.record_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec_id text;
  pub_user_id uuid;
begin
  pub_user_id := public.current_user_id();
  
  if (tg_op = 'DELETE') then
    rec_id := coalesce(to_jsonb(old)->>'id', to_jsonb(old)->>'user_id');
    insert into public.audit_records(actor_id, action, table_name, record_id, old_data, new_data)
    values (pub_user_id, tg_op, tg_table_name, rec_id, to_jsonb(old), null);
    return old;
  else
    rec_id := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'user_id');
    insert into public.audit_records(actor_id, action, table_name, record_id, old_data, new_data)
    values (pub_user_id, tg_op, tg_table_name, rec_id, to_jsonb(old), to_jsonb(new));
    return new;
  end if;
end;
$$;

do $$
declare tbl text;
begin
  foreach tbl in array array['users','farmers','buyers','transporters','listings','orders','order_status_events','transport_requests','messages','reviews','buyer_alerts','whatsapp_conversations','ai_extraction_logs'] loop
    execute format('drop trigger if exists audit_%I on public.%I', tbl, tbl);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.record_audit()', tbl, tbl);
  end loop;
end $$;

--------------------------------------------------------------------------------
-- 3. INDEXES
--------------------------------------------------------------------------------

create index if not exists users_role_region_idx on public.users(role, region);
create index if not exists listings_crop_location_stock_idx on public.listings(crop_type, location, quantity);
create index if not exists listings_farmer_created_idx on public.listings(farmer_id, created_at desc);
create index if not exists orders_buyer_created_idx on public.orders(buyer_id, created_at desc);
create index if not exists orders_transporter_status_idx on public.orders(transporter_id, status);
create unique index if not exists orders_transaction_id_uidx on public.orders(transaction_id) where transaction_id is not null;
create index if not exists order_status_events_order_created_idx on public.order_status_events(order_id, created_at desc);
create index if not exists transport_requests_status_date_idx on public.transport_requests(status, pickup_date);
create index if not exists messages_receiver_read_idx on public.messages(receiver_id, read, created_at desc);
create index if not exists buyer_alerts_buyer_status_idx on public.buyer_alerts(buyer_id, status);
create index if not exists ai_extraction_logs_created_idx on public.ai_extraction_logs(created_at desc);
create index if not exists audit_records_table_record_idx on public.audit_records(table_name, record_id, created_at desc);

--------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) & POLICIES
--------------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.farmers enable row level security;
alter table public.buyers enable row level security;
alter table public.transporters enable row level security;
alter table public.listings enable row level security;
alter table public.orders enable row level security;
alter table public.order_status_events enable row level security;
alter table public.transport_requests enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.buyer_alerts enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.ai_extraction_logs enable row level security;
alter table public.audit_records enable row level security;

-- Users
drop policy if exists users_select_policy on public.users;
create policy users_select_policy on public.users for select using (true);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users for update using (auth.uid() = auth_id) with check (auth.uid() = auth_id);
drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users for insert with check (auth.uid() = auth_id);

-- Listings
drop policy if exists listings_public_read on public.listings;
create policy listings_public_read on public.listings for select using (quantity > 0);

drop policy if exists listings_farmer_all on public.listings;
create policy listings_farmer_all on public.listings for all using (farmer_id = public.current_user_id()) with check (farmer_id = public.current_user_id());

-- Orders
drop policy if exists orders_buyer_read on public.orders;
create policy orders_buyer_read on public.orders for select using (
  buyer_id = public.current_user_id() or 
  transporter_id = public.current_user_id() or
  listing_id in (select id from public.listings where farmer_id = public.current_user_id())
);