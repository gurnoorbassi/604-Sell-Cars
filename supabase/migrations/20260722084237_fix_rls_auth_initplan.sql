drop policy if exists "Members can read their membership" on public.team_members;
create policy "Members can read their membership"
on public.team_members for select to authenticated
using (email = lower((select auth.jwt())->>'email') and active);

drop policy if exists "Active team members can read inventory" on public.inventory;
create policy "Active team members can read inventory"
on public.inventory for select to authenticated
using (exists (select 1 from public.team_members tm where tm.email = lower((select auth.jwt())->>'email') and tm.active));

drop policy if exists "Active team members can add inventory" on public.inventory;
create policy "Active team members can add inventory"
on public.inventory for insert to authenticated
with check (exists (select 1 from public.team_members tm where tm.email = lower((select auth.jwt())->>'email') and tm.active));

drop policy if exists "Active team members can update inventory" on public.inventory;
create policy "Active team members can update inventory"
on public.inventory for update to authenticated
using (exists (select 1 from public.team_members tm where tm.email = lower((select auth.jwt())->>'email') and tm.active))
with check (exists (select 1 from public.team_members tm where tm.email = lower((select auth.jwt())->>'email') and tm.active));

drop policy if exists "Active team members can delete inventory" on public.inventory;
create policy "Active team members can delete inventory"
on public.inventory for delete to authenticated
using (exists (select 1 from public.team_members tm where tm.email = lower((select auth.jwt())->>'email') and tm.active));

drop policy if exists "Active team members can manage media" on public.vehicle_media;
create policy "Active team members can manage media"
on public.vehicle_media for all to authenticated
using (exists (select 1 from public.team_members tm where tm.email = lower((select auth.jwt())->>'email') and tm.active))
with check (exists (select 1 from public.team_members tm where tm.email = lower((select auth.jwt())->>'email') and tm.active));

drop policy if exists "Team members can read vehicle media objects" on storage.objects;
create policy "Team members can read vehicle media objects"
on storage.objects for select to authenticated
using (bucket_id = 'vehicle-media' and exists (select 1 from public.team_members tm where tm.email = lower((select auth.jwt())->>'email') and tm.active));

drop policy if exists "Team members can insert vehicle media objects" on storage.objects;
create policy "Team members can insert vehicle media objects"
on storage.objects for insert to authenticated
with check (bucket_id = 'vehicle-media' and exists (select 1 from public.team_members tm where tm.email = lower((select auth.jwt())->>'email') and tm.active));

drop policy if exists "Team members can update vehicle media objects" on storage.objects;
create policy "Team members can update vehicle media objects"
on storage.objects for update to authenticated
using (bucket_id = 'vehicle-media' and exists (select 1 from public.team_members tm where tm.email = lower((select auth.jwt())->>'email') and tm.active))
with check (bucket_id = 'vehicle-media' and exists (select 1 from public.team_members tm where tm.email = lower((select auth.jwt())->>'email') and tm.active));

drop policy if exists "Team members can delete vehicle media objects" on storage.objects;
create policy "Team members can delete vehicle media objects"
on storage.objects for delete to authenticated
using (bucket_id = 'vehicle-media' and exists (select 1 from public.team_members tm where tm.email = lower((select auth.jwt())->>'email') and tm.active));
