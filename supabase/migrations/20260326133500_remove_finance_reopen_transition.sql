BEGIN;

DELETE FROM public.claim_status_transitions cst
USING public.claim_statuses from_status,
      public.claim_statuses to_status,
      public.roles role_row
WHERE cst.from_status_id = from_status.id
  AND cst.to_status_id = to_status.id
  AND cst.requires_role_id = role_row.id
  AND cst.action_code = 'reopened'
  AND from_status.status_code IN ('REJECTED', 'L3_REJECTED_FINANCE')
  AND to_status.status_code IN ('L3_PENDING_FINANCE_REVIEW', 'PENDING_FINANCE_REVIEW')
  AND role_row.is_finance_role = true;

COMMIT;
