begin;

alter table public.leads
  add column if not exists appointment_lot text;

update public.leads l
set appointment_lot = c.lot
from public.cars c
where l.car_id = c.id
  and l.appointment_lot is null;

alter table public.leads
  alter column appointment_lot set not null;

create unique index if not exists leads_unique_booked_lot_slot
  on public.leads (appointment_lot, appointment_time)
  where appointment_status = 'booked';

create or replace function public.submit_lead(
  p_name text,
  p_phone text,
  p_email text,
  p_car_id text,
  p_budget numeric,
  p_appointment_time timestamptz
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
  v_first_date date;
begin
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'Name is required.';
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
  v_first_date := v_now_local::date
    + case when v_now_local::time >= time '19:00' then 1 else 0 end;
  if p_appointment_time is null or p_appointment_time <= now() then
    raise exception 'Appointment time must be in the future.';
  end if;
  if v_local::date < v_first_date or v_local::date > v_first_date + 13 then
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

  select exists(select 1 from public.leads where phone = v_phone)
  into v_existing;

  insert into public.leads (
    name, phone, email, car_id, budget, appointment_time, appointment_lot
  )
  values (
    btrim(p_name), v_phone, nullif(btrim(coalesce(p_email, '')), ''),
    v_car.id, p_budget, p_appointment_time, v_car.lot
  )
  on conflict (phone) do update set
    name = excluded.name,
    email = excluded.email,
    car_id = excluded.car_id,
    budget = excluded.budget,
    appointment_time = excluded.appointment_time,
    appointment_lot = excluded.appointment_lot,
    appointment_status = 'booked',
    reminder_24h_sent_at = null,
    reminder_2h_sent_at = null
  returning * into v_lead;

  return jsonb_build_object(
    'isNew', not v_existing,
    'lead', jsonb_build_object(
      'id', v_lead.id,
      'name', v_lead.name,
      'appointmentTime', v_lead.appointment_time
    ),
    'car', jsonb_build_object(
      'id', v_car.id,
      'name', coalesce(
        nullif(concat_ws(' ', v_car.year, v_car.make, v_car.model, v_car.trim), ''),
        v_car.title
      ),
      'lotName', v_car.lot_name,
      'lotAddress', v_car.lot_address
    )
  );
end
$$;

revoke all on function public.submit_lead(text, text, text, text, numeric, timestamptz)
  from public, anon, authenticated;
grant execute on function public.submit_lead(text, text, text, text, numeric, timestamptz)
  to service_role;

commit;
