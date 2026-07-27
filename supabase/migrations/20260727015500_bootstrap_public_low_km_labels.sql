update public.cars
set public_labels = array_append(public_labels, 'LOW KM')
where status = 'available'
  and mileage is not null
  and mileage > 0
  and mileage <= 50000
  and not ('LOW KM' = any(public_labels));
