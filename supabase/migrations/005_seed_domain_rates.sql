insert into public.expense_reimbursement_rates (designation, vehicle_type, rate_type, amount)
values
  ('Student Relationship Officer', null, 'food_base_daily', 120),
  ('Business Operation Associate', null, 'food_base_daily', 120),
  ('Area Business Head', null, 'food_base_daily', 120),
  ('State Business Head', null, 'food_base_daily', 120),
  ('Zonal Business Head', null, 'food_base_daily', 120),
  ('Program Manager', null, 'food_base_daily', 120),

  ('Student Relationship Officer', null, 'food_outstation_daily', 350),
  ('Business Operation Associate', null, 'food_outstation_daily', 350),
  ('Area Business Head', null, 'food_outstation_daily', 350),
  ('State Business Head', null, 'food_outstation_daily', 350),
  ('Zonal Business Head', null, 'food_outstation_daily', 350),
  ('Program Manager', null, 'food_outstation_daily', 350),

  ('Student Relationship Officer', 'Two Wheeler', 'fuel_base_daily', 180),
  ('Business Operation Associate', 'Two Wheeler', 'fuel_base_daily', 180),
  ('Area Business Head', 'Two Wheeler', 'fuel_base_daily', 180),
  ('State Business Head', 'Two Wheeler', 'fuel_base_daily', 180),
  ('Zonal Business Head', 'Two Wheeler', 'fuel_base_daily', 180),
  ('Program Manager', 'Two Wheeler', 'fuel_base_daily', 180),

  ('State Business Head', 'Four Wheeler', 'fuel_base_daily', 300),
  ('Zonal Business Head', 'Four Wheeler', 'fuel_base_daily', 300),
  ('Program Manager', 'Four Wheeler', 'fuel_base_daily', 300),

  ('Student Relationship Officer', 'Two Wheeler', 'intercity_per_km', 5),
  ('Business Operation Associate', 'Two Wheeler', 'intercity_per_km', 5),
  ('Area Business Head', 'Two Wheeler', 'intercity_per_km', 5),
  ('State Business Head', 'Two Wheeler', 'intercity_per_km', 5),
  ('Zonal Business Head', 'Two Wheeler', 'intercity_per_km', 5),
  ('Program Manager', 'Two Wheeler', 'intercity_per_km', 5),

  ('State Business Head', 'Four Wheeler', 'intercity_per_km', 8),
  ('Zonal Business Head', 'Four Wheeler', 'intercity_per_km', 8),
  ('Program Manager', 'Four Wheeler', 'intercity_per_km', 8),

  ('Student Relationship Officer', null, 'accommodation_daily', 1000),
  ('Business Operation Associate', null, 'accommodation_daily', 1000),
  ('Area Business Head', null, 'accommodation_daily', 1000),
  ('State Business Head', null, 'accommodation_daily', 2000),
  ('Zonal Business Head', null, 'accommodation_daily', 2000),
  ('Program Manager', null, 'accommodation_daily', 2000)
on conflict (designation, vehicle_type, rate_type)
do update set amount = excluded.amount;
