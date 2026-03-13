BEGIN;

-- Release the target name if a legacy inactive status currently owns it.
UPDATE public.claim_statuses
SET status_name = 'Legacy Finance Approved'
WHERE status_code = 'L3_APPROVED_FINANCE'
  AND status_name = 'Finance Approved';

-- Keep status code and id intact, only change the display label.
UPDATE public.claim_statuses
SET status_name = 'Finance Approved',
    status_description = 'Claim approved and payment issued to employee'
WHERE status_code = 'APPROVED';

-- Only these statuses should be visible in active frontend catalogs.
UPDATE public.claim_statuses
SET is_active = CASE
  WHEN status_code IN (
    'L1_PENDING',
    'L1_REJECTED',
    'L2_PENDING',
    'L2_REJECTED',
    'L3_PENDING_FINANCE_REVIEW',
    'L3_REJECTED_FINANCE',
    'APPROVED'
  )
  THEN true
  ELSE false
END;

COMMIT;