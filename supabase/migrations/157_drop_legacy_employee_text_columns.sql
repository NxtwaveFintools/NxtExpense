-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 157: Drop legacy denormalized text columns from employees
--
-- employees.designation and employees.state were denormalized text caches kept
-- in sync by the trg_sync_employee_designation trigger. All application code
-- now reads designation via JOIN to designations table and state via JOIN to
-- employee_states + states tables. The trigger and redundant columns are removed.
--
-- NOTE: This migration does NOT touch expense_claims legacy columns
-- (outstation_location, from_city, to_city) — those are still active in
-- mutations and will be cleaned up in a separate migration.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Drop the sync trigger that maintained employees.designation ────────────

DROP TRIGGER IF EXISTS trg_sync_employee_designation ON public.employees;
DROP FUNCTION IF EXISTS public.sync_employee_designation_from_id();

-- ── 2. Drop legacy denormalized text columns ─────────────────────────────────

ALTER TABLE public.employees
  DROP COLUMN IF EXISTS designation,
  DROP COLUMN IF EXISTS state;
