drop policy if exists "Editors can manage media" on public.vehicle_media;

create policy "Editors can add media"
on public.vehicle_media for insert to authenticated
with check (
  exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'member')
  )
);

create policy "Editors can update media"
on public.vehicle_media for update to authenticated
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

create policy "Editors can delete media"
on public.vehicle_media for delete to authenticated
using (
  exists (
    select 1 from public.team_members tm
    where tm.email = lower((select auth.jwt())->>'email')
      and tm.active
      and tm.role in ('owner', 'member')
  )
);
