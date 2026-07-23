alter table public.inventory
add column if not exists version integer not null default 1
check (version > 0);

alter table public.vehicle_media
add column if not exists migration_attempted_at timestamptz,
add column if not exists migration_error text;

create table if not exists public.inventory_audit (
  id bigint generated always as identity primary key,
  vehicle_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id),
  old_record jsonb,
  new_record jsonb
);

create index if not exists inventory_audit_vehicle_changed_idx
on public.inventory_audit (vehicle_id, changed_at desc);

create index if not exists inventory_audit_changed_by_idx
on public.inventory_audit (changed_by);

alter table public.inventory_audit enable row level security;
revoke all on table public.inventory_audit from anon;
grant select on table public.inventory_audit to authenticated;

drop policy if exists "Editors can read inventory audit" on public.inventory_audit;
create policy "Editors can read inventory audit"
on public.inventory_audit for select to authenticated
using (
  exists (
    select 1
    from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'admin')
  )
);

create or replace function private.audit_inventory_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.inventory_audit (vehicle_id, action, changed_by, new_record)
    values (new.id, 'insert', auth.uid(), to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    new.version := old.version + 1;
    insert into public.inventory_audit (vehicle_id, action, changed_by, old_record, new_record)
    values (new.id, 'update', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.inventory_audit (vehicle_id, action, changed_by, old_record)
    values (old.id, 'delete', auth.uid(), to_jsonb(old));
    return old;
  end if;
end;
$$;

revoke all on function private.audit_inventory_change() from public;

drop trigger if exists audit_inventory_changes on public.inventory;
create trigger audit_inventory_changes
before insert or update or delete on public.inventory
for each row execute function private.audit_inventory_change();

create or replace function private.add_bdc_team_member_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null then
    insert into public.team_members (email, role, active)
    values (lower(new.email), 'bdc', false)
    on conflict (email) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.add_bdc_team_member_on_signup() from public;

drop function if exists public.reserve_ai_generation(integer, integer);
drop function if exists public.release_ai_generation(bigint);

create or replace function private.enforce_ai_generation_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text := lower(coalesce((select auth.jwt())->>'email', ''));
  day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
begin
  if caller_id is null or not exists (
    select 1
    from public.team_members tm
    where tm.email = caller_email
      and tm.active
      and tm.role in ('owner', 'admin')
  ) then
    raise exception 'AI generation is restricted to active owners and admins';
  end if;

  if new.user_id <> caller_id then
    raise exception 'AI usage can only be recorded for the signed-in user';
  end if;

  perform pg_advisory_xact_lock(hashtext('inventory-ai:' || day_start::text));

  if (
    select count(*)
    from public.ai_generation_usage u
    where u.user_id = caller_id and u.requested_at >= day_start
  ) >= 10 then
    raise exception 'Daily personal AI description limit reached';
  end if;

  if (
    select count(*)
    from public.ai_generation_usage u
    where u.requested_at >= day_start
  ) >= 30 then
    raise exception 'Daily dealership AI description limit reached';
  end if;

  new.requested_at := now();
  new.rate_bucket := date_trunc('minute', now());
  return new;
end;
$$;

revoke all on function private.enforce_ai_generation_limits() from public, anon, authenticated;

drop trigger if exists enforce_ai_generation_limits on public.ai_generation_usage;
create trigger enforce_ai_generation_limits
before insert on public.ai_generation_usage
for each row execute function private.enforce_ai_generation_limits();

grant delete on table public.ai_generation_usage to authenticated;
drop policy if exists "Editors can release failed AI usage" on public.ai_generation_usage;
create policy "Editors can release failed AI usage"
on public.ai_generation_usage for delete to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'admin')
  )
);

update public.inventory
set body_type = case
  when lower(title || ' ' || description) ~ '\bconvertible\b|\bcabriolet\b|\broadster\b' then 'Convertible'
  when lower(title || ' ' || description) ~ '\bhatchback\b|\bhatch\b' then 'Hatchback'
  when lower(title || ' ' || description) ~ '\bwagon\b|\bavant\b|\bestate\b' then 'Wagon'
  when lower(title || ' ' || description) ~ '\bminivan\b' then 'Minivan'
  else body_type
end
where lower(title || ' ' || description) ~
  '\bconvertible\b|\bcabriolet\b|\broadster\b|\bhatchback\b|\bhatch\b|\bwagon\b|\bavant\b|\bestate\b|\bminivan\b';

update public.inventory
set fuel_tags = (
  select array_agg(distinct tag order by tag)
  from unnest(
    fuel_tags
    || case when lower(title || ' ' || description) ~ '\bautomatic\b|\bauto transmission\b' then array['Automatic'] else '{}' end
    || case when lower(title || ' ' || description) ~ '\bgasoline\b|\bpetrol\b|\bgas engine\b' then array['Gasoline'] else '{}' end
    || case when lower(title || ' ' || description) ~ '\bawd\b|all-wheel drive' then array['AWD'] else '{}' end
    || case when lower(title || ' ' || description) ~ '\b4wd\b|\b4x4\b|four-wheel drive' then array['4WD'] else '{}' end
    || case when lower(title || ' ' || description) ~ '\bfwd\b|front-wheel drive' then array['FWD'] else '{}' end
  ) as tag
)
where lower(title || ' ' || description) ~
  '\bautomatic\b|\bauto transmission\b|\bgasoline\b|\bpetrol\b|\bgas engine\b|\bawd\b|all-wheel drive|\b4wd\b|\b4x4\b|four-wheel drive|\bfwd\b|front-wheel drive';

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inventory'
  ) then
    alter publication supabase_realtime add table public.inventory;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vehicle_media'
  ) then
    alter publication supabase_realtime add table public.vehicle_media;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'team_members'
  ) then
    alter publication supabase_realtime add table public.team_members;
  end if;
end
$$;
