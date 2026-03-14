BEGIN;

UPDATE public.claim_statuses
SET status_name = CASE status_code
  WHEN 'L1_PENDING' THEN 'Submitted - Awaiting SBH Approval'
  WHEN 'L1_APPROVED' THEN 'SBH Approved - Awaiting HOD Approval'
  WHEN 'L2_PENDING' THEN 'SBH Approved - Awaiting HOD Approval (L2)'
  WHEN 'L2_APPROVED' THEN 'HOD Approved - Awaiting Finance Approval'
  WHEN 'L3_PENDING_FINANCE_REVIEW' THEN 'HOD Approved - Awaiting Finance Approval (L3)'
  WHEN 'APPROVED' THEN 'Finance Approved'
  WHEN 'L1_REJECTED' THEN 'Rejected (SBH)'
  WHEN 'L2_REJECTED' THEN 'Rejected (HOD)'
  WHEN 'L3_REJECTED_FINANCE' THEN 'Rejected (Finance)'
  ELSE status_name
END
WHERE status_code IN (
  'L1_PENDING',
  'L1_APPROVED',
  'L2_PENDING',
  'L2_APPROVED',
  'L3_PENDING_FINANCE_REVIEW',
  'APPROVED',
  'L1_REJECTED',
  'L2_REJECTED',
  'L3_REJECTED_FINANCE'
);

COMMIT;
