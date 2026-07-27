begin;

alter table public.cars
  add column if not exists internal_labels text[] not null default '{}',
  add column if not exists public_labels text[] not null default '{}';

update public.cars
set internal_labels = labels
where cardinality(internal_labels) = 0
  and cardinality(labels) > 0;

alter table public.cars
  drop constraint if exists cars_public_labels_check;
alter table public.cars
  add constraint cars_public_labels_check check (
    public_labels <@ array[
      'PRICE DROP',
      'GREAT VALUE',
      'LOW FINANCE RATE',
      'NEW ARRIVAL',
      'LOW KM',
      'CERTIFIED'
    ]::text[]
  );

alter table public.team_members
  add column if not exists lot_access text[] not null default '{}';

alter table public.leads
  add column if not exists payment_method text,
  add column if not exists down_payment numeric(12, 2),
  add column if not exists credit_range text,
  add column if not exists heard_from text,
  add column if not exists customer_notes text,
  add column if not exists source text not null default '604SELLSCARS',
  add column if not exists handoff_status text not null default 'pending_confirmation',
  add column if not exists routing_flag text;

alter table public.leads
  drop constraint if exists leads_payment_method_check,
  drop constraint if exists leads_down_payment_check,
  drop constraint if exists leads_credit_range_check,
  drop constraint if exists leads_heard_from_check,
  drop constraint if exists leads_handoff_status_check;
alter table public.leads
  add constraint leads_payment_method_check check (
    payment_method is null or payment_method in ('Cash', 'Finance', 'Lease')
  ),
  add constraint leads_down_payment_check check (
    down_payment is null or down_payment >= 0
  ),
  add constraint leads_credit_range_check check (
    credit_range is null or credit_range in (
      'Excellent (750+)',
      'Good (680-749)',
      'Fair (600-679)',
      'Rebuilding (under 600)',
      'Not sure'
    )
  ),
  add constraint leads_heard_from_check check (
    heard_from is null or heard_from in ('Instagram', 'Facebook', 'Google', 'Referral', 'Other')
  ),
  add constraint leads_handoff_status_check check (
    handoff_status in (
      'pending_confirmation',
      'verified',
      'handed_off',
      'source_alternative',
      'closed'
    )
  );

create index if not exists leads_source_idx
  on public.leads (source, created_at desc);
create index if not exists leads_handoff_idx
  on public.leads (handoff_status, appointment_time);

create table if not exists public.seller_leads (
  id bigint generated always as identity primary key,
  name text not null check (btrim(name) <> ''),
  phone text not null unique check (btrim(phone) <> ''),
  vehicle text not null check (btrim(vehicle) <> ''),
  media_paths text[] not null default '{}',
  source text not null default '604SELLSCARS',
  status text not null default 'new'
    check (status in ('new', 'contacted', 'closed')),
  assigned_to text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seller_leads_created_idx
  on public.seller_leads (created_at desc);

drop trigger if exists seller_leads_set_updated_at on public.seller_leads;
create trigger seller_leads_set_updated_at
before update on public.seller_leads
for each row execute function public.set_row_updated_at();

alter table public.seller_leads enable row level security;
revoke all on table public.seller_leads from anon, authenticated;
grant select, insert, update, delete on table public.seller_leads to service_role;
grant usage, select on sequence public.seller_leads_id_seq to service_role;

create or replace function private.protect_lead_source()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.source = old.source;
  return new;
end
$$;

drop trigger if exists leads_protect_source on public.leads;
create trigger leads_protect_source
before update on public.leads
for each row execute function private.protect_lead_source();

create or replace function private.flag_unavailable_vehicle_leads()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'available' and new.status = 'sold' then
    update public.leads
    set
      routing_flag = 'SOURCE ALTERNATIVE',
      handoff_status = 'source_alternative'
    where car_id = new.id
      and appointment_status = 'booked'
      and handoff_status not in ('closed', 'handed_off');
  end if;
  return new;
end
$$;

drop trigger if exists cars_flag_unavailable_leads on public.cars;
create trigger cars_flag_unavailable_leads
after update of status on public.cars
for each row execute function private.flag_unavailable_vehicle_leads();

drop function if exists public.submit_lead(
  text,
  text,
  text,
  text,
  numeric,
  timestamp with time zone
);

create or replace function public.submit_lead(
  p_name text,
  p_phone text,
  p_email text,
  p_car_id text,
  p_budget numeric,
  p_payment_method text,
  p_down_payment numeric,
  p_credit_range text,
  p_appointment_time timestamp with time zone,
  p_heard_from text,
  p_customer_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
  v_digits text;
  v_car public.cars%rowtype;
  v_lead public.leads%rowtype;
  v_existing boolean;
  v_local timestamp;
  v_now_local timestamp;
  v_assigned_to text;
  v_location_label text;
begin
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'Full name is required.';
  end if;

  if btrim(coalesce(p_email, '')) = ''
    or p_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Enter a valid email address.';
  end if;

  v_digits := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  if length(v_digits) = 10 then
    v_phone := '+1' || v_digits;
  elsif length(v_digits) = 11 and left(v_digits, 1) = '1' then
    v_phone := '+' || v_digits;
  elsif left(btrim(coalesce(p_phone, '')), 1) = '+'
    and length(v_digits) between 8 and 15 then
    v_phone := '+' || v_digits;
  else
    raise exception 'Enter a valid phone number including area code.';
  end if;

  if p_budget is null or p_budget < 0 then
    raise exception 'Enter a valid budget.';
  end if;
  if p_payment_method not in ('Cash', 'Finance', 'Lease') then
    raise exception 'Choose Cash, Finance, or Lease.';
  end if;
  if p_payment_method in ('Finance', 'Lease')
    and (p_down_payment is null or p_down_payment < 0) then
    raise exception 'Down payment is required for finance or lease.';
  end if;
  if p_credit_range is not null and p_credit_range not in (
    'Excellent (750+)',
    'Good (680-749)',
    'Fair (600-679)',
    'Rebuilding (under 600)',
    'Not sure'
  ) then
    raise exception 'Choose a valid credit range.';
  end if;
  if p_heard_from is not null and p_heard_from not in (
    'Instagram',
    'Facebook',
    'Google',
    'Referral',
    'Other'
  ) then
    raise exception 'Choose a valid referral source.';
  end if;

  select *
  into v_car
  from public.cars
  where id = p_car_id
  for share;

  if not found or v_car.status <> 'available' then
    raise exception 'That vehicle is no longer available.';
  end if;

  if v_car.lot is null or v_car.lot_name is null or v_car.lot_address is null
    or v_car.lot = 'LOCATION_REQUIRED' or v_car.lot_address = 'ADDRESS REQUIRED' then
    raise exception 'This vehicle needs its lot information corrected before booking.';
  end if;

  v_local := p_appointment_time at time zone 'America/Vancouver';
  v_now_local := now() at time zone 'America/Vancouver';
  if p_appointment_time is null or p_appointment_time < now() + interval '24 hours' then
    raise exception 'Choose a viewing time at least 24 hours from now.';
  end if;
  if v_local::date > v_now_local::date + 13 then
    raise exception 'Appointment must be within the next 14 days.';
  end if;
  if extract(minute from v_local) <> 0 or extract(second from v_local) <> 0 then
    raise exception 'Appointments start on the hour.';
  end if;
  if extract(hour from v_local) < 10 or extract(hour from v_local) > 19 then
    raise exception 'Choose a time between 10:00 AM and 7:00 PM.';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(v_car.lot),
    hashtext(p_appointment_time::text)
  );

  if exists (
    select 1
    from public.leads
    where appointment_lot = v_car.lot
      and appointment_time = p_appointment_time
      and appointment_status = 'booked'
      and phone <> v_phone
  ) then
    raise exception 'That time was just booked. Please choose another.';
  end if;

  select tm.email
  into v_assigned_to
  from public.team_members tm
  where tm.active
    and tm.role in ('bdc', 'admin')
    and v_car.lot = any(tm.lot_access)
  order by
    case when tm.role = 'bdc' then 0 else 1 end,
    tm.email
  limit 1;

  select exists(select 1 from public.leads where phone = v_phone)
  into v_existing;

  insert into public.leads (
    name,
    phone,
    email,
    car_id,
    budget,
    payment_method,
    down_payment,
    credit_range,
    appointment_time,
    appointment_lot,
    assigned_to,
    heard_from,
    customer_notes,
    source,
    handoff_status,
    routing_flag
  )
  values (
    btrim(p_name),
    v_phone,
    lower(btrim(p_email)),
    v_car.id,
    p_budget,
    p_payment_method,
    case when p_payment_method in ('Finance', 'Lease') then p_down_payment else null end,
    nullif(btrim(coalesce(p_credit_range, '')), ''),
    p_appointment_time,
    v_car.lot,
    v_assigned_to,
    nullif(btrim(coalesce(p_heard_from, '')), ''),
    nullif(btrim(coalesce(p_customer_notes, '')), ''),
    '604SELLSCARS',
    'pending_confirmation',
    null
  )
  on conflict (phone) do update set
    name = excluded.name,
    email = excluded.email,
    car_id = excluded.car_id,
    budget = excluded.budget,
    payment_method = excluded.payment_method,
    down_payment = excluded.down_payment,
    credit_range = excluded.credit_range,
    appointment_time = excluded.appointment_time,
    appointment_lot = excluded.appointment_lot,
    assigned_to = coalesce(excluded.assigned_to, public.leads.assigned_to),
    heard_from = excluded.heard_from,
    customer_notes = excluded.customer_notes,
    appointment_status = 'booked',
    handoff_status = 'pending_confirmation',
    routing_flag = null,
    reminder_24h_sent_at = null,
    reminder_2h_sent_at = null
  returning * into v_lead;

  v_location_label := case
    when v_car.lot_address ilike '%langley%' then 'Near Langley'
    when v_car.lot_address ilike '%surrey%' then 'Near Surrey'
    when v_car.lot_address ilike '%coquitlam%' then 'Near Coquitlam'
    else 'Lower Mainland'
  end;

  return jsonb_build_object(
    'isNew', not v_existing,
    'lead', jsonb_build_object(
      'id', v_lead.id,
      'name', v_lead.name,
      'appointmentTime', v_lead.appointment_time,
      'handoffStatus', v_lead.handoff_status
    ),
    'car', jsonb_build_object(
      'id', v_car.id,
      'name', coalesce(
        nullif(concat_ws(' ', v_car.year, v_car.make, v_car.model, v_car.trim), ''),
        v_car.title
      ),
      'locationLabel', v_location_label
    ),
    'message', 'We''ve got it. Someone from our team will confirm your viewing within 24 hours.'
  );
end
$$;

revoke all on function public.submit_lead(
  text,
  text,
  text,
  text,
  numeric,
  text,
  numeric,
  text,
  timestamp with time zone,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.submit_lead(
  text,
  text,
  text,
  text,
  numeric,
  text,
  numeric,
  text,
  timestamp with time zone,
  text,
  text
) to service_role;

commit;
