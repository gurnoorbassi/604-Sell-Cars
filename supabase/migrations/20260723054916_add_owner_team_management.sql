alter table public.team_members
drop constraint if exists team_members_role_check;

update public.team_members
set role = 'admin'
where role = 'member';

alter table public.team_members
alter column role set default 'bdc';

alter table public.team_members
add constraint team_members_role_check
check (role in ('owner', 'admin', 'bdc'));

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_inventory_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.email = lower(coalesce((select auth.jwt())->>'email', ''))
      and tm.active
      and tm.role = 'owner'
  );
$$;

revoke all on function private.is_inventory_owner() from public;
grant execute on function private.is_inventory_owner() to authenticated;

grant select, insert, update, delete on table public.team_members to authenticated;

drop policy if exists "Members can read their membership" on public.team_members;
create policy "Members can read allowed team records"
on public.team_members for select to authenticated
using (
  (email = lower((select auth.jwt())->>'email') and active)
  or (select private.is_inventory_owner())
);

create policy "Owners can add team members"
on public.team_members for insert to authenticated
with check (
  (select private.is_inventory_owner())
  and role in ('admin', 'bdc')
);

create policy "Owners can update non-owner team members"
on public.team_members for update to authenticated
using (
  (select private.is_inventory_owner())
  and role <> 'owner'
)
with check (
  (select private.is_inventory_owner())
  and role in ('admin', 'bdc')
);

create policy "Owners can remove non-owner team members"
on public.team_members for delete to authenticated
using (
  (select private.is_inventory_owner())
  and role <> 'owner'
);

drop policy if exists "Editors can add inventory" on public.inventory;
create policy "Editors can add inventory"
on public.inventory for insert to authenticated
with check (
  exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'admin')
  )
);

drop policy if exists "Editors can update inventory" on public.inventory;
create policy "Editors can update inventory"
on public.inventory for update to authenticated
using (
  exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'admin')
  )
);

drop policy if exists "Editors can delete inventory" on public.inventory;
create policy "Editors can delete inventory"
on public.inventory for delete to authenticated
using (
  exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'admin')
  )
);

drop policy if exists "Editors can add media" on public.vehicle_media;
create policy "Editors can add media"
on public.vehicle_media for insert to authenticated
with check (
  exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'admin')
  )
);

drop policy if exists "Editors can update media" on public.vehicle_media;
create policy "Editors can update media"
on public.vehicle_media for update to authenticated
using (
  exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'admin')
  )
);

drop policy if exists "Editors can delete media" on public.vehicle_media;
create policy "Editors can delete media"
on public.vehicle_media for delete to authenticated
using (
  exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'admin')
  )
);

drop policy if exists "Editors can insert vehicle media objects" on storage.objects;
create policy "Editors can insert vehicle media objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'vehicle-media'
  and exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'admin')
  )
);

drop policy if exists "Editors can update vehicle media objects" on storage.objects;
create policy "Editors can update vehicle media objects"
on storage.objects for update to authenticated
using (
  bucket_id = 'vehicle-media'
  and exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'admin')
  )
)
with check (
  bucket_id = 'vehicle-media'
  and exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'admin')
  )
);

drop policy if exists "Editors can delete vehicle media objects" on storage.objects;
create policy "Editors can delete vehicle media objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'vehicle-media'
  and exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'admin')
  )
);

drop policy if exists "Editors can record their own AI usage" on public.ai_generation_usage;
create policy "Editors can record their own AI usage"
on public.ai_generation_usage for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'admin')
  )
);
