BEGIN;

-- Improve contrast between first-level pending approvals and reclaim-allowed rejections.
UPDATE public.claim_statuses
SET display_color = 'blue'
WHERE status_code = 'L1_PENDING'
  AND COALESCE(is_active, true) = true;

UPDATE public.claim_statuses
SET allow_resubmit_display_color = COALESCE(allow_resubmit_display_color, 'orange')
WHERE status_code = 'REJECTED'
  AND COALESCE(is_rejection, false) = true
  AND COALESCE(is_active, true) = true;

COMMIT;
