create table public.team_members (
  email text primary key check (email = lower(email)),
  role text not null default 'member' check (role in ('owner', 'member')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.inventory (
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
  status text not null default 'live' check (status in ('live', 'sold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table public.vehicle_media (
  id bigint generated always as identity primary key,
  vehicle_id text not null references public.inventory(id) on delete cascade,
  kind text not null default 'image' check (kind in ('image', 'video')),
  source_url text not null default '',
  storage_path text,
  sort_order integer not null default 0 check (sort_order >= 0),
  mime_type text,
  created_at timestamptz not null default now(),
  unique (vehicle_id, kind, sort_order)
);

create index inventory_status_idx on public.inventory(status);
create index inventory_dealership_idx on public.inventory(dealership);
create index inventory_updated_at_idx on public.inventory(updated_at desc);
create index vehicle_media_vehicle_sort_idx on public.vehicle_media(vehicle_id, sort_order);

alter table public.team_members enable row level security;
alter table public.inventory enable row level security;
alter table public.vehicle_media enable row level security;

revoke all on table public.team_members, public.inventory, public.vehicle_media from anon;
grant select on table public.team_members to authenticated;
grant select, insert, update, delete on table public.inventory, public.vehicle_media to authenticated;
grant usage, select on sequence public.vehicle_media_id_seq to authenticated;

create policy "Members can read their membership"
on public.team_members for select to authenticated
using (email = (select lower(auth.jwt()->>'email')) and active);

create policy "Active team members can read inventory"
on public.inventory for select to authenticated
using (exists (select 1 from public.team_members tm where tm.email = (select lower(auth.jwt()->>'email')) and tm.active));

create policy "Active team members can add inventory"
on public.inventory for insert to authenticated
with check (exists (select 1 from public.team_members tm where tm.email = (select lower(auth.jwt()->>'email')) and tm.active));

create policy "Active team members can update inventory"
on public.inventory for update to authenticated
using (exists (select 1 from public.team_members tm where tm.email = (select lower(auth.jwt()->>'email')) and tm.active))
with check (exists (select 1 from public.team_members tm where tm.email = (select lower(auth.jwt()->>'email')) and tm.active));

create policy "Active team members can delete inventory"
on public.inventory for delete to authenticated
using (exists (select 1 from public.team_members tm where tm.email = (select lower(auth.jwt()->>'email')) and tm.active));

create policy "Active team members can manage media"
on public.vehicle_media for all to authenticated
using (exists (select 1 from public.team_members tm where tm.email = (select lower(auth.jwt()->>'email')) and tm.active))
with check (exists (select 1 from public.team_members tm where tm.email = (select lower(auth.jwt()->>'email')) and tm.active));

insert into storage.buckets (id, name, public, file_size_limit)
values ('vehicle-media', 'vehicle-media', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy "Team members can read vehicle media objects"
on storage.objects for select to authenticated
using (bucket_id = 'vehicle-media' and exists (select 1 from public.team_members tm where tm.email = (select lower(auth.jwt()->>'email')) and tm.active));

create policy "Team members can insert vehicle media objects"
on storage.objects for insert to authenticated
with check (bucket_id = 'vehicle-media' and exists (select 1 from public.team_members tm where tm.email = (select lower(auth.jwt()->>'email')) and tm.active));

create policy "Team members can update vehicle media objects"
on storage.objects for update to authenticated
using (bucket_id = 'vehicle-media' and exists (select 1 from public.team_members tm where tm.email = (select lower(auth.jwt()->>'email')) and tm.active))
with check (bucket_id = 'vehicle-media' and exists (select 1 from public.team_members tm where tm.email = (select lower(auth.jwt()->>'email')) and tm.active));

create policy "Team members can delete vehicle media objects"
on storage.objects for delete to authenticated
using (bucket_id = 'vehicle-media' and exists (select 1 from public.team_members tm where tm.email = (select lower(auth.jwt()->>'email')) and tm.active));

insert into public.team_members (email, role)
values ('gurnoorbassi@gmail.com', 'owner')
on conflict (email) do update set role = excluded.role, active = true;
