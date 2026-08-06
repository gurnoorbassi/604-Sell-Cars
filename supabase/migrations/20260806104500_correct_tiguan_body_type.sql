update public.cars
set body_type = 'SUV',
    updated_at = now()
where id = 'c5c97d57'
  and body_type = 'Sedan';
