begin;

alter table public.leads
  add column if not exists consent_sms boolean not null default false,
  add column if not exists reminder_3h_sent_at timestamptz,
  add column if not exists reminder_1h_sent_at timestamptz;

alter table public.leads
  drop constraint if exists leads_appointment_status_check;

alter table public.leads
  add constraint leads_appointment_status_check check (
    appointment_status in (
      'new',
      'assigned',
      'booked',
      'cancelled',
      'completed',
      'no_show'
    )
  );

drop index if exists public.leads_unique_booked_lot_slot;
create unique index leads_unique_active_lot_slot
  on public.leads (appointment_lot, appointment_time)
  where appointment_status in ('new', 'assigned', 'booked');

create index if not exists leads_sms_reminder_queue_idx
  on public.leads (appointment_time)
  where consent_sms
    and appointment_status in ('new', 'assigned', 'booked');

comment on column public.leads.consent_sms is
  'Express consent for transactional appointment SMS. False suppresses every customer SMS.';
comment on column public.leads.reminder_2h_sent_at is
  'Deprecated by the 24h/3h/1h SMS reminder sequence. Retained for migration compatibility.';

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
      and appointment_status in ('new', 'assigned', 'booked')
      and handoff_status not in ('closed', 'handed_off');
  end if;
  return new;
end
$$;

create or replace function public.submit_lead_with_sms_consent(
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
  p_customer_notes text,
  p_consent_sms boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_lead_id bigint;
begin
  begin
    v_result := public.submit_lead(
      p_name,
      p_phone,
      p_email,
      p_car_id,
      p_budget,
      p_payment_method,
      p_down_payment,
      p_credit_range,
      p_appointment_time,
      p_heard_from,
      p_customer_notes
    );
  exception
    when unique_violation then
      raise exception 'That time was just booked. Please choose another.';
  end;

  v_lead_id := nullif(v_result #>> '{lead,id}', '')::bigint;

  update public.leads
  set
    consent_sms = coalesce(p_consent_sms, false),
    reminder_24h_sent_at = null,
    reminder_3h_sent_at = null,
    reminder_1h_sent_at = null,
    reminder_2h_sent_at = null
  where id = v_lead_id;

  return v_result || jsonb_build_object(
    'lead',
    (v_result -> 'lead') || jsonb_build_object(
      'consentSms',
      coalesce(p_consent_sms, false)
    )
  );
end
$$;

revoke all on function public.submit_lead_with_sms_consent(
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
  text,
  boolean
) from public, anon, authenticated;

grant execute on function public.submit_lead_with_sms_consent(
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
  text,
  boolean
) to service_role;

commit;
