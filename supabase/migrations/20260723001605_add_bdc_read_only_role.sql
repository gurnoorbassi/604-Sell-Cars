alter table public.team_members
drop constraint if exists team_members_role_check;

alter table public.team_members
add constraint team_members_role_check
check (role in ('owner', 'member', 'bdc'));

drop policy if exists "Active team members can add inventory" on public.inventory;
create policy "Editors can add inventory"
on public.inventory for insert to authenticated
with check (
  exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'member')
  )
);

drop policy if exists "Active team members can update inventory" on public.inventory;
create policy "Editors can update inventory"
on public.inventory for update to authenticated
using (
  exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'member')
  )
)
with check (
  exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'member')
  )
);

drop policy if exists "Active team members can delete inventory" on public.inventory;
create policy "Editors can delete inventory"
on public.inventory for delete to authenticated
using (
  exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'member')
  )
);

drop policy if exists "Active team members can manage media" on public.vehicle_media;
create policy "Active team members can read media"
on public.vehicle_media for select to authenticated
using (
  exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
  )
);

create policy "Editors can manage media"
on public.vehicle_media for all to authenticated
using (
  exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'member')
  )
)
with check (
  exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'member')
  )
);

drop policy if exists "Team members can insert vehicle media objects" on storage.objects;
create policy "Editors can insert vehicle media objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'vehicle-media'
  and exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'member')
  )
);

drop policy if exists "Team members can update vehicle media objects" on storage.objects;
create policy "Editors can update vehicle media objects"
on storage.objects for update to authenticated
using (
  bucket_id = 'vehicle-media'
  and exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'member')
  )
)
with check (
  bucket_id = 'vehicle-media'
  and exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'member')
  )
);

drop policy if exists "Team members can delete vehicle media objects" on storage.objects;
create policy "Editors can delete vehicle media objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'vehicle-media'
  and exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'member')
  )
);

drop policy if exists "Team members can record their own AI usage" on public.ai_generation_usage;
create policy "Editors can record their own AI usage"
on public.ai_generation_usage for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'member')
  )
);
