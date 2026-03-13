-- Migration 158: Drop legacy city text columns from expense_claims
-- The UUID FK columns (outstation_city_id, from_city_id, to_city_id) have been
-- fully populated from their text counterparts and are now the source of truth.
-- All application code has been updated to read/write via the FK columns only.

ALTER TABLE public.expense_claims
  DROP COLUMN IF EXISTS outstation_location,
  DROP COLUMN IF EXISTS from_city,
  DROP COLUMN IF EXISTS to_city;
