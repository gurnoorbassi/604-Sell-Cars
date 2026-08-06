-- Preserve manually assigned tags, add only evidence-backed classifications,
-- and correct body styles that were collapsed by the legacy importer.
with body_corrections(id, body_type) as (
  values
    ('3db64c77', 'Hatchback'),
    ('63979616', 'Hatchback'),
    ('a65efa33', 'Hatchback'),
    ('de1d7b2e', 'Hatchback'),
    ('f2c6c26d', 'Hatchback'),
    ('e66b951d', 'Hatchback'),
    ('c406ebcf', 'Hatchback'),
    ('db2f6d68', 'Convertible'),
    ('448f302a', 'Convertible'),
    ('c5ad654e', 'Convertible'),
    ('e88ceaf7', 'Minivan')
), source as (
  select
    cars.id,
    lower(coalesce(cars.title, '') || E'\n' || coalesce(cars.description, '')) as search_text,
    coalesce(cars.fuel_tags, '{}'::text[]) as existing_tags,
    coalesce(body_corrections.body_type, cars.body_type) as corrected_body_type
  from public.cars
  left join body_corrections on body_corrections.id = cars.id
), inferred as (
  select
    source.*,
    array_remove(array[
      case when search_text ~ '\m(hybrid|plug[- ]?in|phev|hev|prius)\M' then 'Hybrid' end,
      case when search_text ~ '\m(all[- ]electric|fully electric|battery electric|electric vehicle|ev|tesla|model [3sxy]|ioniq [56]|ev6|ev9|mach[- ]?e|id\.4|ariya|leaf|bolt|polestar|taycan|e-tron|eq[abes]|bmw i[457x]|ix|lyriq)\M' then 'Electric' end,
      case when search_text ~ '\m(diesel|tdi|bluetec|duramax|cummins|power stroke|ecodiesel)\M' then 'Diesel' end,
      case when search_text ~ '\m([567][- ]speed manual|manual transmission|stick shift)\M' then 'Manual' end,
      case when search_text ~ '\m(automatic|cvt|dct|tiptronic|dual[- ]clutch)\M' then 'Automatic' end,
      case when search_text ~ '\m(awd|all[- ]wheel drive|quattro|4matic|xdrive)\M' then 'AWD' end,
      case when search_text ~ '\m(4wd|4x4|four[- ]wheel drive)\M' then '4WD' end,
      case when search_text ~ '\m(fwd|front[- ]wheel drive)\M' then 'FWD' end,
      case when search_text ~ '\m(amg|hellcat|srt|scat pack|type r|golf r|gti|wrx|sti|gr corolla|gr supra|mustang gt|shelby|camaro ss|zl1|corvette|nismo|track[- ]focused)\M' then 'Performance' end,
      case when search_text ~ '\m(rolls[- ]?royce|bentley|aston martin|ferrari|lamborghini|maserati|porsche|mercedes|amg|bmw|audi|lexus|acura|infiniti|genesis|land rover|range rover|jaguar|cadillac|lincoln|volvo|karma)\M' then 'Luxury' end,
      case when search_text ~ '\m(brand[- ]new|never registered)\M' then 'Brand New' end
    ], null) as inferred_tags
  from source
), combined as (
  select
    inferred.*,
    existing_tags || inferred_tags as preliminary_tags
  from inferred
), normalized as (
  select
    combined.id,
    combined.corrected_body_type,
    array(
      select tag
      from (
        select tag, min(ordinality) as first_position
        from unnest(
          combined.preliminary_tags
          || case
            when combined.preliminary_tags && array['Hybrid', 'Electric', 'Diesel']::text[] then '{}'::text[]
            else array['Gasoline']::text[]
          end
        ) with ordinality as listed(tag, ordinality)
        where tag is not null and btrim(tag) <> ''
        group by tag
      ) unique_tags
      order by first_position
    ) as fuel_tags
  from combined
)
update public.cars as cars
set
  body_type = normalized.corrected_body_type,
  fuel_tags = normalized.fuel_tags,
  updated_at = now()
from normalized
where cars.id = normalized.id
  and (
    cars.body_type is distinct from normalized.corrected_body_type
    or cars.fuel_tags is distinct from normalized.fuel_tags
  );

-- photo_count means image count, not image + video count.
update public.cars as cars
set photo_count = media.image_count,
    updated_at = now()
from (
  select vehicle_id, count(*) filter (where kind = 'image')::integer as image_count,
         count(*) filter (where kind = 'video')::integer as video_count
  from public.vehicle_media
  group by vehicle_id
) media
where cars.id = media.vehicle_id
  and media.video_count > 0
  and cars.photo_count = media.image_count + media.video_count;
