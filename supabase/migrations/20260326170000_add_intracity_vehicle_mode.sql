BEGIN;

ALTER TABLE public.expense_claims
ADD COLUMN IF NOT EXISTS intracity_vehicle_mode TEXT;

UPDATE public.expense_claims
SET intracity_vehicle_mode = CASE
  WHEN has_intracity_travel = true THEN CASE
    WHEN COALESCE(intracity_own_vehicle_used, false) = true THEN 'OWN_VEHICLE'
    ELSE 'RENTAL_VEHICLE'
  END
  ELSE NULL
END
WHERE intracity_vehicle_mode IS NULL;

ALTER TABLE public.expense_claims
DROP CONSTRAINT IF EXISTS expense_claims_intracity_vehicle_mode_valid;

ALTER TABLE public.expense_claims
ADD CONSTRAINT expense_claims_intracity_vehicle_mode_valid
CHECK (
  intracity_vehicle_mode IS NULL
  OR intracity_vehicle_mode IN ('OWN_VEHICLE', 'RENTAL_VEHICLE')
);

ALTER TABLE public.expense_claims
DROP CONSTRAINT IF EXISTS expense_claims_intracity_mode_consistent;

ALTER TABLE public.expense_claims
ADD CONSTRAINT expense_claims_intracity_mode_consistent
CHECK (
  (has_intracity_travel = true AND intracity_vehicle_mode IS NOT NULL)
  OR (has_intracity_travel = false AND intracity_vehicle_mode IS NULL)
);

ALTER TABLE public.expense_claims
DROP CONSTRAINT IF EXISTS expense_claims_intercity_intracity_mode_consistent;

ALTER TABLE public.expense_claims
ADD CONSTRAINT expense_claims_intercity_intracity_mode_consistent
CHECK (
  has_intercity_travel = false
  OR intracity_vehicle_mode = 'OWN_VEHICLE'
);

CREATE INDEX IF NOT EXISTS idx_expense_claims_intracity_vehicle_mode
ON public.expense_claims(intracity_vehicle_mode)
WHERE has_intracity_travel = true;

COMMIT;
