BEGIN;

ALTER TABLE public.expense_claims
ADD COLUMN IF NOT EXISTS base_location_day_type_code varchar(50);

COMMENT ON COLUMN public.expense_claims.base_location_day_type_code IS
  'Base-location day type code selected at claim submission time (for example FULL_DAY or HALF_DAY).';

WITH base_location AS (
  SELECT id
  FROM public.work_locations
  WHERE location_code = 'FIELD_BASE'
  LIMIT 1
)
UPDATE public.expense_claims ec
SET base_location_day_type_code = 'FULL_DAY'
FROM base_location bl
WHERE ec.work_location_id = bl.id
  AND ec.base_location_day_type_code IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'expense_claims_base_location_day_type_code_fkey'
      AND conrelid = 'public.expense_claims'::regclass
  ) THEN
    ALTER TABLE public.expense_claims
      ADD CONSTRAINT expense_claims_base_location_day_type_code_fkey
      FOREIGN KEY (base_location_day_type_code)
      REFERENCES public.base_location_day_types(day_type_code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_expense_claims_base_location_day_type_code
  ON public.expense_claims (base_location_day_type_code);

COMMIT;
