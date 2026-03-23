BEGIN;

ALTER TABLE public.work_locations
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.work_locations
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

COMMIT;
