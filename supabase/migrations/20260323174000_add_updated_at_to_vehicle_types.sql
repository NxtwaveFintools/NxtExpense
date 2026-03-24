BEGIN;

ALTER TABLE public.vehicle_types
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.vehicle_types
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

COMMIT;
