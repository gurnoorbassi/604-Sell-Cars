begin;

update public.cars
set
  lot_name = 'Lougheed Hyundai',
  lot_address = '1288 Lougheed Hwy, Coquitlam, BC V3K 6S4',
  updated_at = now()
where lot = 'Lougheed Hyundai'
  and (lot_address is null or lot_address = 'ADDRESS REQUIRED');

update public.cars
set
  lot_name = 'SkyHigh Motors',
  lot_address = '16065 Fraser Hwy, Surrey, BC V4N 0G2',
  updated_at = now()
where lot = 'SkyHigh Auto'
  and (lot_address is null or lot_address = 'ADDRESS REQUIRED');

commit;
