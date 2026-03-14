BEGIN;

ALTER TABLE public.claim_statuses
DROP CONSTRAINT IF EXISTS claim_statuses_status_name_key;

UPDATE public.claim_statuses
SET status_name = CASE status_code
  WHEN 'L2_PENDING' THEN 'SBH Approved - Awaiting HOD Approval'
  WHEN 'L2_APPROVED' THEN 'HOD Approved - Awaiting Finance Review'
  WHEN 'L3_PENDING_FINANCE_REVIEW' THEN 'HOD Approved - Awaiting Finance Review'
  ELSE status_name
END,
status_description = CASE status_code
  WHEN 'L2_APPROVED' THEN 'Approved by Program Manager, moving to Finance Review'
  WHEN 'L3_PENDING_FINANCE_REVIEW' THEN 'Finance team is reviewing and verifying the claim'
  ELSE status_description
END
WHERE status_code IN (
  'L2_PENDING',
  'L2_APPROVED',
  'L3_PENDING_FINANCE_REVIEW'
);

COMMIT;
