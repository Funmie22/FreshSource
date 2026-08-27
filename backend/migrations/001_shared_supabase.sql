-- FreshSource shared schema migration.
-- Safe to run in a new or existing Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.users (
	id uuid primary key default gen_random_uuid(),
	auth_id uuid unique references auth.users(id) on delete set null,
	phone text unique,
	name text,
	role text check (role in ('farmer', 'buyer', 'transporter')),
	region text,
	created_at timestamptz not null default now()
);

create table if not exists public.listings (
	id uuid primary key default gen_random_uuid(),
	farmer_id uuid not null references public.users(id) on delete cascade,
	crop_type text not null,
	unit text not null default 'bags',
	quantity numeric(12, 2) not null check (quantity >= 0),
	price_per_unit numeric(12, 2) not null check (price_per_unit > 0),
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
	quantity numeric(12, 2) not null check (quantity > 0),
	total_price numeric(12, 2) not null check (total_price >= 0),
	status text not null default 'pending',
	payment_status text not null default 'pending',
	created_at timestamptz not null default now()
);

alter table public.users add column if not exists region text;
alter table public.users add column if not exists phone text;
alter table public.users add column if not exists role text;
alter table public.listings add column if not exists unit text not null default 'bags';
alter table public.listings add column if not exists updated_at timestamptz not null default now();
alter table public.orders add column if not exists payment_status text not null default 'pending';

create index if not exists users_phone_idx on public.users(phone);
create index if not exists users_region_idx on public.users(region);
create index if not exists listings_unit_idx on public.listings(unit);

create index if not exists listings_crop_type_idx on public.listings(crop_type);
create index if not exists listings_location_idx on public.listings(location);
create index if not exists listings_farmer_id_idx on public.listings(farmer_id);
create index if not exists orders_buyer_id_idx on public.orders(buyer_id);
create index if not exists orders_listing_id_idx on public.orders(listing_id);

alter table public.users enable row level security;
alter table public.listings enable row level security;
alter table public.orders enable row level security;

-- Confirm the existing database uses UUID-compatible id and foreign-key columns
-- before running the API. Do not cast production identifiers automatically.
