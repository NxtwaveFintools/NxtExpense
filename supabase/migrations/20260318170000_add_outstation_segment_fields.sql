-- Add explicit inter-city/intra-city segment fields for outstation claims.
-- This enables claiming both segments in a single day while keeping legacy
-- own_vehicle_used and existing city fields backward-compatible.

BEGIN;

-- =============================================================================
-- 1. Add new columns
-- =============================================================================
ALTER TABLE public.expense_claims
  ADD COLUMN IF NOT EXISTS has_intercity_travel BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_intracity_travel BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS intercity_own_vehicle_used BOOLEAN,
  ADD COLUMN IF NOT EXISTS intracity_own_vehicle_used BOOLEAN;

-- =============================================================================
-- 2. Backfill from legacy outstation shape
-- =============================================================================
WITH outstation_location AS (
  SELECT id
  FROM public.work_locations
  WHERE location_code = 'FIELD_OUTSTATION'
  LIMIT 1
)
UPDATE public.expense_claims ec
SET
  has_intercity_travel = CASE
    WHEN ec.from_city_id IS NOT NULL AND ec.to_city_id IS NOT NULL THEN true
    ELSE false
  END,
  has_intracity_travel = false,
  intercity_own_vehicle_used = CASE
    WHEN ec.from_city_id IS NOT NULL AND ec.to_city_id IS NOT NULL
      THEN ec.own_vehicle_used
    ELSE NULL
  END,
  intracity_own_vehicle_used = NULL
FROM outstation_location ol
WHERE ec.work_location_id = ol.id;

-- =============================================================================
-- 3. Integrity constraints
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'expense_claims_intercity_requires_route'
      AND conrelid = 'public.expense_claims'::regclass
  ) THEN
    ALTER TABLE public.expense_claims
      ADD CONSTRAINT expense_claims_intercity_requires_route
      CHECK (
        has_intercity_travel = false
        OR (from_city_id IS NOT NULL AND to_city_id IS NOT NULL)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'expense_claims_intracity_requires_city'
      AND conrelid = 'public.expense_claims'::regclass
  ) THEN
    ALTER TABLE public.expense_claims
      ADD CONSTRAINT expense_claims_intracity_requires_city
      CHECK (
        has_intracity_travel = false
        OR outstation_city_id IS NOT NULL
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'expense_claims_intercity_vehicle_flag_consistent'
      AND conrelid = 'public.expense_claims'::regclass
  ) THEN
    ALTER TABLE public.expense_claims
      ADD CONSTRAINT expense_claims_intercity_vehicle_flag_consistent
      CHECK (
        has_intercity_travel = true
        OR intercity_own_vehicle_used IS NULL
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'expense_claims_intracity_vehicle_flag_consistent'
      AND conrelid = 'public.expense_claims'::regclass
  ) THEN
    ALTER TABLE public.expense_claims
      ADD CONSTRAINT expense_claims_intracity_vehicle_flag_consistent
      CHECK (
        has_intracity_travel = true
        OR intracity_own_vehicle_used IS NULL
      );
  END IF;
END $$;

-- =============================================================================
-- 4. Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_expense_claims_has_intercity
  ON public.expense_claims(has_intercity_travel);

CREATE INDEX IF NOT EXISTS idx_expense_claims_has_intracity
  ON public.expense_claims(has_intracity_travel);

COMMIT;
