BEGIN;

-- Restore allow_resubmit at claim-level for reclaim workflows.
-- This column is required by claims, approvals, finance, and dashboard modules.
ALTER TABLE public.expense_claims
ADD COLUMN IF NOT EXISTS allow_resubmit boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.expense_claims.allow_resubmit IS
  'True only when the current claim is in a rejection state that allows employee resubmission.';

-- Backfill from latest approval/finance action that explicitly carried allow_resubmit.
WITH latest_history AS (
  SELECT DISTINCT ON (ah.claim_id)
    ah.claim_id,
    COALESCE(ah.allow_resubmit, false) AS allow_resubmit
  FROM public.approval_history ah
  WHERE ah.allow_resubmit IS NOT NULL
  ORDER BY ah.claim_id, ah.acted_at DESC, ah.id DESC
)
UPDATE public.expense_claims ec
SET allow_resubmit = latest_history.allow_resubmit
FROM latest_history
WHERE ec.id = latest_history.claim_id
  AND ec.allow_resubmit IS DISTINCT FROM latest_history.allow_resubmit;

-- Non-rejection statuses must not remain reclaimable.
UPDATE public.expense_claims ec
SET allow_resubmit = false
FROM public.claim_statuses cs
WHERE ec.status_id = cs.id
  AND COALESCE(cs.is_rejection, false) = false
  AND ec.allow_resubmit IS DISTINCT FROM false;

COMMIT;