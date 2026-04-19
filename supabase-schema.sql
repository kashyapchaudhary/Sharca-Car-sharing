create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    name text not null,
    role text not null check (role in ('user', 'driver')),
    phone text default '',
    car text default '',
    plate text default '',
    avatar_url text default '',
    created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;


-- FIX: drop existing policies before creating
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);


create table if not exists public.ride_offers (
    id bigint generated always as identity primary key,
    driver_id uuid not null references public.profiles(id) on delete cascade,
    driver_name text not null,
    car_details text default '',
    origin text not null,
    destination text not null,
    ride_date date not null,
    ride_time text not null,
    seats_left integer not null check (seats_left > 0),
    price integer not null check (price >= 0),
    status text not null default 'active' check (status in ('active', 'cancelled')),
    created_at timestamptz not null default now()
);

create table if not exists public.trip_bookings (
    id bigint generated always as identity primary key,
    ride_offer_id bigint references public.ride_offers(id) on delete set null,
    rider_id uuid not null references public.profiles(id) on delete cascade,
    driver_id uuid references public.profiles(id) on delete set null,
    origin text not null,
    destination text not null,
    trip_date date,
    trip_time text default '',
    price integer not null default 0,
    status text not null check (status in ('saved', 'pending', 'accepted', 'completed', 'cancelled')),
    driver_name text default '',
    car_details text default '',
    payment_method text default '',
    created_at timestamptz not null default now(),
    completed_at timestamptz
);

alter table public.ride_offers enable row level security;
alter table public.trip_bookings enable row level security;

ALTER TABLE public.trip_bookings ADD COLUMN IF NOT EXISTS payment_method TEXT;


-- FIX: drop policies before creating
drop policy if exists "Anyone can read active ride offers" on public.ride_offers;
drop policy if exists "Drivers can insert own ride offers" on public.ride_offers;
drop policy if exists "Drivers can update own ride offers" on public.ride_offers;
drop policy if exists "Drivers can delete own ride offers" on public.ride_offers;

create policy "Anyone can read active ride offers"
on public.ride_offers
for select
to authenticated
using (status = 'active' or auth.uid() = driver_id);

create policy "Drivers can insert own ride offers"
on public.ride_offers
for insert
to authenticated
with check (auth.uid() = driver_id);

create policy "Drivers can update own ride offers"
on public.ride_offers
for update
to authenticated
using (auth.uid() = driver_id)
with check (auth.uid() = driver_id);

create policy "Drivers can delete own ride offers"
on public.ride_offers
for delete
to authenticated
using (auth.uid() = driver_id);

-- FIX: drop policies before creating
drop policy if exists "Riders and assigned drivers can read bookings" on public.trip_bookings;
drop policy if exists "Riders can insert own bookings" on public.trip_bookings;
drop policy if exists "Riders and assigned drivers can update bookings" on public.trip_bookings;

create policy "Riders and assigned drivers can read bookings"
on public.trip_bookings
for select
to authenticated
using (auth.uid() = rider_id or auth.uid() = driver_id);

create policy "Riders can insert own bookings"
on public.trip_bookings
for insert
to authenticated
with check (auth.uid() = rider_id);

create policy "Riders and assigned drivers can update bookings"
on public.trip_bookings
for update
to authenticated
using (auth.uid() = rider_id or auth.uid() = driver_id)
with check (auth.uid() = rider_id or auth.uid() = driver_id);