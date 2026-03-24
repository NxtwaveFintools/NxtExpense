create type public.designation_type as enum (
  'Student Relationship Officer',
  'Business Operation Associate',
  'Area Business Head',
  'State Business Head',
  'Zonal Business Head',
  'Program Manager'
);

create type public.vehicle_type as enum (
  'Two Wheeler',
  'Four Wheeler'
);

create type public.work_location_type as enum (
  'Office / WFH',
  'Field - Base Location',
  'Field - Outstation',
  'Leave',
  'Week-off'
);

create type public.expense_item_type as enum (
  'food',
  'fuel',
  'taxi_bill',
  'intercity_travel',
  'accommodation',
  'travel_bus_train'
);

create type public.claim_status as enum (
  'draft',
  'submitted',
  'pending_approval',
  'approved',
  'rejected'
);

create type public.approval_action_type as enum (
  'approved',
  'rejected'
);
