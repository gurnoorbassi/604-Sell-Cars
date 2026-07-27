update public.team_members
set lot_access = (
  select coalesce(array_agg(distinct lot order by lot), '{}'::text[])
  from public.cars
  where lot is not null
    and lot <> 'LOCATION_REQUIRED'
)
where active
  and role = 'admin'
  and cardinality(lot_access) = 0;
