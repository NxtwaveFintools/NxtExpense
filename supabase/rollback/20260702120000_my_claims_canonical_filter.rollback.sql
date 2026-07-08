-- Rollback for 20260702120000_my_claims_canonical_filter.sql
-- All three functions are purely additive (no prior version existed) —
-- rollback is a straight drop, in dependency order (dependents first).

drop function if exists public.get_my_claims_metrics(
  uuid, uuid, boolean, uuid, date, date
);

drop function if exists public.get_my_claims_page(
  uuid, uuid, boolean, uuid, date, date, timestamptz, uuid, integer
);

drop function if exists public.my_claims_filtered(
  uuid, uuid, boolean, uuid, date, date
);
