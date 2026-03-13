-- Migration 139: Add UUID-based approver columns to employees
-- Adds approval_employee_id_level_1/2/3 as UUID FKs to replace the
-- approval_email_level_1/2/3 text columns used for approver lookups.
-- Backfills values via email-to-employee-id resolution.
-- The old text columns are RETAINED until migration 144 which drops them.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Add UUID FK columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS approval_employee_id_level_1 uuid REFERENCES public.employees(id),
  ADD COLUMN IF NOT EXISTS approval_employee_id_level_2 uuid REFERENCES public.employees(id),
  ADD COLUMN IF NOT EXISTS approval_employee_id_level_3 uuid REFERENCES public.employees(id);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Backfill level_1 from approval_email_level_1
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.employees e
SET approval_employee_id_level_1 = ref.id
FROM public.employees ref
WHERE lower(ref.employee_email) = lower(e.approval_email_level_1)
  AND e.approval_email_level_1 IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Backfill level_2 from approval_email_level_2
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.employees e
SET approval_employee_id_level_2 = ref.id
FROM public.employees ref
WHERE lower(ref.employee_email) = lower(e.approval_email_level_2)
  AND e.approval_email_level_2 IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Backfill level_3 from approval_email_level_3
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.employees e
SET approval_employee_id_level_3 = ref.id
FROM public.employees ref
WHERE lower(ref.employee_email) = lower(e.approval_email_level_3)
  AND e.approval_email_level_3 IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Add indexes for the new FK columns (used in RPC approver lookups)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_employees_approver_id_l1
  ON public.employees(approval_employee_id_level_1);

CREATE INDEX IF NOT EXISTS idx_employees_approver_id_l2
  ON public.employees(approval_employee_id_level_2);

CREATE INDEX IF NOT EXISTS idx_employees_approver_id_l3
  ON public.employees(approval_employee_id_level_3);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: Verify backfill integrity (log counts for audit)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_orphaned int;
BEGIN
  -- Check for employees with email set but no ID resolved (suggests stale email)
  SELECT count(*) INTO v_orphaned
  FROM public.employees
  WHERE approval_email_level_1 IS NOT NULL
    AND approval_employee_id_level_1 IS NULL;

  IF v_orphaned > 0 THEN
    RAISE WARNING 'Migration 139: % employees have approval_email_level_1 set but no matching employee record found.',
      v_orphaned;
  END IF;

  SELECT count(*) INTO v_orphaned
  FROM public.employees
  WHERE approval_email_level_3 IS NOT NULL
    AND approval_employee_id_level_3 IS NULL;

  IF v_orphaned > 0 THEN
    RAISE WARNING 'Migration 139: % employees have approval_email_level_3 set but no matching employee record found.',
      v_orphaned;
  END IF;
END;
$$;

COMMIT;
