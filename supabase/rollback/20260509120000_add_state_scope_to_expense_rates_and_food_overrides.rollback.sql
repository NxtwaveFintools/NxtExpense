-- Rollback for: 20260509120000_add_state_scope_to_expense_rates_and_food_overrides.sql
--
-- IMPORTANT:
-- - This file is for local review and versioning.
-- - Do not execute until explicitly approved.

WITH target_states AS (
  SELECT id
  FROM public.states
  WHERE state_name IN ('Andhra Pradesh', 'Telangana')
),
target_locations AS (
  SELECT id
  FROM public.work_locations
  WHERE location_code IN ('FIELD_BASE', 'FIELD_OUTSTATION')
)
DELETE FROM public.expense_rates er
USING target_states ts, target_locations tl
WHERE er.state_id = ts.id
  AND er.location_id = tl.id
  AND er.expense_type IN ('FOOD_BASE', 'FOOD_OUTSTATION')
  AND er.designation_id IS NULL
  AND er.effective_from = DATE '2026-05-09'
  AND er.effective_to IS NULL
  AND er.created_at = TIMESTAMPTZ '2026-05-09 12:00:00+00';

DROP INDEX IF EXISTS public.idx_er_rate_resolution;

ALTER TABLE public.expense_rates
DROP CONSTRAINT IF EXISTS expense_rates_state_id_fkey;

ALTER TABLE public.expense_rates
DROP COLUMN IF EXISTS state_id;
