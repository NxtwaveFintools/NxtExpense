-- DB-driven status display overrides for rejection flows that allow reclaim.
-- This keeps UI labels/colors configurable in claim_statuses instead of hardcoded in app code.

ALTER TABLE public.claim_statuses
ADD COLUMN IF NOT EXISTS allow_resubmit_status_name varchar(120),
ADD COLUMN IF NOT EXISTS allow_resubmit_display_color varchar(32);

COMMENT ON COLUMN public.claim_statuses.allow_resubmit_status_name IS
'Display label to use when a claim is in this status and allow_resubmit=true.';

COMMENT ON COLUMN public.claim_statuses.allow_resubmit_display_color IS
'Display color token to use when a claim is in this status and allow_resubmit=true.';

UPDATE public.claim_statuses
SET
  allow_resubmit_status_name = COALESCE(allow_resubmit_status_name, 'Rejected - Reclaim Allowed'),
  allow_resubmit_display_color = COALESCE(allow_resubmit_display_color, 'orange')
WHERE status_code = 'REJECTED'
  AND COALESCE(is_rejection, false) = true
  AND COALESCE(is_active, true) = true;