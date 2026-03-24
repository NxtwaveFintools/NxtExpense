BEGIN;

DROP TABLE IF EXISTS public.transport_types CASCADE;

ALTER TABLE public.employees
  DROP COLUMN IF EXISTS date_of_joining,
  DROP COLUMN IF EXISTS date_of_leaving;

ALTER TABLE public.employee_statuses
  DROP COLUMN IF EXISTS is_active_status;

COMMIT;