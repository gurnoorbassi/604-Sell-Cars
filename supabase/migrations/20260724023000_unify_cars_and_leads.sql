begin;

-- Preserve the existing inventory records while making cars the one canonical table.
do $$
begin
  if to_regclass('public.cars') is null and to_regclass('public.inventory') is not null then
    alter table public.inventory rename to cars;
  end if;
end
$$;

create table if not exists public.cars (
  id text primary key,
  title text not null,
  stock text not null default '',
  price text not null default '',
  kms text not null default '',
  dealership text not null default '',
  body_type text not null default '',
  fuel_tags text[] not null default '{}',
  labels text[] not null default '{}',
  description text not null default '',
  carfax_url text not null default '',
  trello_url text not null default '',
  photo_count integer not null default 0 check (photo_count >= 0),
  hot boolean not null default false,
  is_new boolean not null default false,
  status text not null default 'available',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.vehicle_media (
  id bigint generated always as identity primary key,
  vehicle_id text not null references public.cars(id) on delete cascade,
  kind text not null default 'image' check (kind in ('image', 'video')),
  source_url text not null default '',
  storage_path text,
  sort_order integer not null default 0 check (sort_order >= 0),
  mime_type text,
  migration_attempted_at timestamptz,
  migration_error text,
  created_at timestamptz not null default now(),
  unique (vehicle_id, kind, sort_order)
);

alter table public.cars
  add column if not exists year integer,
  add column if not exists make text,
  add column if not exists model text,
  add column if not exists trim text,
  add column if not exists price_amount numeric(12, 2),
  add column if not exists mileage integer,
  add column if not exists lot text,
  add column if not exists lot_name text,
  add column if not exists lot_address text,
  add column if not exists fuel_type text,
  add column if not exists images text[] not null default '{}',
  add column if not exists videos text[] not null default '{}',
  add column if not exists featured boolean not null default false;

-- Existing dealership values are physical-lot names, not user-entered guesses.
-- Explicit sentinel values flag legacy records that require owner correction.
update public.cars
set
  lot = coalesce(nullif(btrim(lot), ''), nullif(btrim(dealership), ''), 'LOCATION_REQUIRED'),
  lot_name = coalesce(nullif(btrim(lot_name), ''), nullif(btrim(dealership), ''), 'LOCATION REQUIRED'),
  lot_address = coalesce(nullif(btrim(lot_address), ''), 'ADDRESS REQUIRED'),
  price_amount = coalesce(
    price_amount,
    nullif(regexp_replace(price, '[^0-9.]', '', 'g'), '')::numeric
  ),
  mileage = coalesce(
    mileage,
    case
      when kms ~ '[0-9]' and kms !~* 'x'
        then nullif(regexp_replace(kms, '[^0-9]', '', 'g'), '')::integer
      else null
    end
  ),
  year = coalesce(year, nullif(substring(title from '(19[0-9]{2}|20[0-9]{2})'), '')::integer)
where
  lot is null or btrim(lot) = ''
  or lot_name is null or btrim(lot_name) = ''
  or lot_address is null or btrim(lot_address) = ''
  or price_amount is null
  or mileage is null
  or year is null;

-- Convert the legacy live/sold vocabulary to the public available/sold contract.
alter table public.cars drop constraint if exists inventory_status_check;
alter table public.cars drop constraint if exists cars_status_check;
update public.cars set status = 'available' where status = 'live';
alter table public.cars
  alter column lot set not null,
  alter column lot_name set not null,
  alter column lot_address set not null,
  alter column status set default 'available';
alter table public.cars
  add constraint cars_status_check check (status in ('available', 'sold')),
  add constraint cars_lot_required check (btrim(lot) <> ''),
  add constraint cars_lot_name_required check (btrim(lot_name) <> ''),
  add constraint cars_lot_address_required check (btrim(lot_address) <> ''),
  add constraint cars_year_check check (year is null or year between 1900 and 2200),
  add constraint cars_price_check check (price_amount is null or price_amount >= 0),
  add constraint cars_mileage_check check (mileage is null or mileage >= 0);

create index if not exists cars_public_inventory_idx
  on public.cars (status, featured desc, updated_at desc);
create index if not exists cars_lot_idx on public.cars (lot);
create index if not exists cars_filter_idx
  on public.cars (make, year, body_type, fuel_type);
create index if not exists vehicle_media_vehicle_sort_idx
  on public.vehicle_media (vehicle_id, sort_order);

create table if not exists public.leads (
  id bigint generated always as identity primary key,
  name text not null check (btrim(name) <> ''),
  phone text not null unique check (btrim(phone) <> ''),
  email text,
  car_id text not null references public.cars(id),
  budget numeric(12, 2) not null check (budget >= 0),
  appointment_time timestamptz not null,
  appointment_status text not null default 'booked'
    check (appointment_status in ('booked', 'cancelled')),
  assigned_to text,
  notes text,
  reminder_24h_sent_at timestamptz,
  reminder_2h_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_appointment_idx
  on public.leads (appointment_status, appointment_time);
create index if not exists leads_car_idx on public.leads (car_id);

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_row_updated_at();

-- Leads are only reachable through the self-hosted Express API.
alter table public.leads enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.leads from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table public.leads from authenticated;
  end if;
end
$$;

commit;
