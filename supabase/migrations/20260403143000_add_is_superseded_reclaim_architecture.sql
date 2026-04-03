BEGIN;

-- Reclaim flow requires claim supersession support.
ALTER TABLE public.expense_claims
ADD COLUMN IF NOT EXISTS is_superseded boolean NOT NULL DEFAULT false;

-- Keep this idempotent in case some environments already have the column.
ALTER TABLE public.expense_claims
ADD COLUMN IF NOT EXISTS allow_resubmit boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.expense_claims.is_superseded IS
  'True when a rejected claim has been superseded by a fresh resubmitted claim for the same date.';

-- Legacy unique constraint blocks reclaim inserts for the same employee+date.
ALTER TABLE public.expense_claims
DROP CONSTRAINT IF EXISTS expense_claims_employee_id_claim_date_key;

-- Enforce uniqueness only for active (non-superseded) claims.
DROP INDEX IF EXISTS public.unique_active_claim_per_date;

CREATE UNIQUE INDEX IF NOT EXISTS expense_claims_one_active_per_employee_date
ON public.expense_claims (employee_id, claim_date)
WHERE (NOT is_superseded);

DROP FUNCTION IF EXISTS public.supersede_rejected_claim(uuid);
CREATE OR REPLACE FUNCTION public.supersede_rejected_claim(p_claim_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_email text;
  v_employee_id uuid;
  v_claim public.expense_claims%ROWTYPE;
  v_is_rejection boolean;
BEGIN
  v_email := public.current_user_email();
  IF coalesce(v_email, '') = '' THEN
    RAISE EXCEPTION 'Unauthorized.';
  END IF;

  SELECT id
  INTO v_employee_id
  FROM public.employees
  WHERE lower(employee_email) = v_email
  ;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Employee record not found.';
  END IF;

  SELECT *
  INTO v_claim
  FROM public.expense_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found.';
  END IF;

  IF v_claim.employee_id != v_employee_id THEN
    RAISE EXCEPTION 'You can only supersede your own claims.';
  END IF;

  SELECT cs.is_rejection
  INTO v_is_rejection
  FROM public.claim_statuses cs
  WHERE cs.id = v_claim.status_id;

  IF NOT v_is_rejection THEN
    RAISE EXCEPTION 'Only rejected claims can be superseded.';
  END IF;

  IF NOT v_claim.allow_resubmit THEN
    RAISE EXCEPTION 'This claim is permanently closed - no new claim is permitted for this date.';
  END IF;

  UPDATE public.expense_claims
  SET is_superseded = TRUE,
      updated_at = now()
  WHERE id = p_claim_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.supersede_rejected_claim(uuid) TO authenticated;

COMMIT;