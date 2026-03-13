-- Migration 141: Status System Overhaul
-- 1. Rename L4_ISSUED → APPROVED in claim_statuses; update all display names
-- 2. Mark obsolete intermediate statuses as inactive
-- 3. Re-seed designation_approval_flow with simplified 3-level routing
-- 4. Update approval_routing: level 3 → FINANCE_TEAM, deactivate level 4
-- 5. Add action_code + allow_resubmit columns to claim_status_transitions
-- 6. Re-seed claim_status_transitions with 17 simplified transitions
-- 7. Backfill expense_claims.status_id for any null/stale rows

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 0: Update resolve_status_id() to map 'issued' → 'APPROVED'
--         Must run BEFORE the L4_ISSUED → APPROVED rename to avoid a gap.
--         Migration 142 admin_rollback_claim_atomic still calls this function.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_status_id(
  p_status text,
  p_level  int DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_code text;
BEGIN
  v_code := CASE p_status
    WHEN 'draft'                     THEN 'DRAFT'
    WHEN 'submitted'                 THEN 'SUBMITTED'
    WHEN 'returned_for_modification' THEN 'RETURNED_FOR_MODIFICATION'
    WHEN 'finance_review'            THEN 'L3_PENDING_FINANCE_REVIEW'
    WHEN 'finance_rejected'          THEN 'L3_REJECTED_FINANCE'
    WHEN 'issued'                    THEN 'APPROVED'   -- was L4_ISSUED, renamed in this migration
    WHEN 'pending_approval' THEN
      CASE p_level
        WHEN 1 THEN 'L1_PENDING'
        WHEN 2 THEN 'L2_PENDING'
        ELSE        'L1_PENDING'
      END
    WHEN 'approved' THEN 'APPROVED'
    WHEN 'rejected' THEN
      CASE p_level
        WHEN 1 THEN 'L1_REJECTED'
        WHEN 2 THEN 'L2_REJECTED'
        ELSE        'L1_REJECTED'
      END
    ELSE NULL
  END;

  IF v_code IS NULL THEN RETURN NULL; END IF;
  RETURN (SELECT id FROM public.claim_statuses WHERE status_code = v_code LIMIT 1);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Rename L4_ISSUED → APPROVED and update display labels
-- ─────────────────────────────────────────────────────────────────────────────

-- Rename the terminal payment status to APPROVED
UPDATE public.claim_statuses
SET status_code        = 'APPROVED',
    status_name        = 'Approved',
    status_description = 'Claim approved and payment issued to employee',
    is_terminal        = true,
    is_payment_issued  = true,
    display_color      = 'green'
WHERE status_code = 'L4_ISSUED';

-- Update display names to match new approval-level language
UPDATE public.claim_statuses SET
  status_name        = 'Waiting for SBH Approval',
  status_description = 'Awaiting State Business Head approval'
WHERE status_code = 'L1_PENDING';

UPDATE public.claim_statuses SET
  status_name        = 'Waiting for HOD Approval',
  status_description = 'Awaiting Program Manager (HOD) approval'
WHERE status_code = 'L2_PENDING';

UPDATE public.claim_statuses SET
  status_name        = 'Finance Team Reviewing',
  status_description = 'Finance team is reviewing and verifying the claim'
WHERE status_code = 'L3_PENDING_FINANCE_REVIEW';

UPDATE public.claim_statuses SET
  status_name        = 'Rejected by SBH',
  status_description = 'Permanently rejected by State Business Head'
WHERE status_code = 'L1_REJECTED';

UPDATE public.claim_statuses SET
  status_name        = 'Rejected by HOD',
  status_description = 'Permanently rejected by Program Manager (HOD)'
WHERE status_code = 'L2_REJECTED';

UPDATE public.claim_statuses SET
  status_name        = 'Rejected by Finance',
  status_description = 'Permanently rejected by Finance team'
WHERE status_code = 'L3_REJECTED_FINANCE';

UPDATE public.claim_statuses SET
  status_name        = 'Returned for Correction',
  status_description = 'Returned to employee for corrections, resubmission allowed'
WHERE status_code = 'RETURNED_FOR_MODIFICATION';

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Mark obsolete intermediate statuses as inactive
--         These status codes will no longer appear in the active workflow
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.claim_statuses
SET is_active = false
WHERE status_code IN (
  'L1_APPROVED',                 -- Replaced by direct L1_PENDING → L2_PENDING
  'L2_APPROVED',                 -- Replaced by direct L2_PENDING → L3_PENDING_FINANCE_REVIEW
  'L3_APPROVED_FINANCE',         -- Replaced by direct L3_PENDING_FINANCE_REVIEW → APPROVED
  'L4_PENDING_PAYMENT_PROCESSING', -- Removed: single-step finance action now
  'L4_PAYMENT_FAILED'            -- Removed: simplified payment flow
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Re-seed designation_approval_flow with simplified 3-level routing
--         Level 1 = SBH approval, Level 2 = HOD (Mansoor), Level 3 = Finance
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.designation_approval_flow daf
SET required_approval_levels = ARRAY[1, 2, 3]
FROM public.designations d
WHERE daf.designation_id = d.id
  AND d.designation_code IN ('SRO', 'BOA', 'ABH');

UPDATE public.designation_approval_flow daf
SET required_approval_levels = ARRAY[2, 3]
FROM public.designations d
WHERE daf.designation_id = d.id
  AND d.designation_code IN ('SBH', 'ZBH');

-- PM goes directly to Finance (no L1 or L2 approval stop)
UPDATE public.designation_approval_flow daf
SET required_approval_levels = ARRAY[3]
FROM public.designations d
WHERE daf.designation_id = d.id
  AND d.designation_code = 'PM';

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Update approval_routing
--         Level 3 rows: change FINANCE_REVIEWER → FINANCE_TEAM
--         Level 4 rows: deactivate (FINANCE_PROCESSOR role is gone)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.approval_routing
SET approver_role_id = (SELECT id FROM public.roles WHERE role_code = 'FINANCE_TEAM')
WHERE approval_level = 3
  AND approver_role_id = (SELECT id FROM public.roles WHERE role_code = 'FINANCE_REVIEWER');

UPDATE public.approval_routing
SET is_active = false
WHERE approval_level = 4;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Add action_code and allow_resubmit columns to claim_status_transitions
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.claim_status_transitions
  ADD COLUMN IF NOT EXISTS action_code text,
  ADD COLUMN IF NOT EXISTS allow_resubmit boolean;

COMMENT ON COLUMN public.claim_status_transitions.action_code IS
  'RPC action code: submit, resubmit, approved, rejected, finance_issued, finance_rejected, reopened';
COMMENT ON COLUMN public.claim_status_transitions.allow_resubmit IS
  'For rejection transitions: true = employee can resubmit (RETURNED), false = terminal rejection';

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: Re-seed claim_status_transitions with 17 simplified transitions
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM public.claim_status_transitions;

INSERT INTO public.claim_status_transitions
  (from_status_id, to_status_id, requires_role_id, requires_comment, is_auto_transition, action_code, allow_resubmit)
VALUES

  -- ── 1. Employee submits a draft ──────────────────────────────────────────
  (get_claim_status_id('DRAFT'),
   get_claim_status_id('SUBMITTED'),
   get_role_id('EMPLOYEE'),
   false, false, 'submit', null),

  -- ── 2–4. Routing after submission (RPC picks the matching branch) ─────────
  (get_claim_status_id('SUBMITTED'),
   get_claim_status_id('L1_PENDING'),
   null, false, true, 'route_l1', null),

  (get_claim_status_id('SUBMITTED'),
   get_claim_status_id('L2_PENDING'),
   null, false, true, 'route_l2', null),

  (get_claim_status_id('SUBMITTED'),
   get_claim_status_id('L3_PENDING_FINANCE_REVIEW'),
   null, false, true, 'route_l3', null),

  -- ── 5. L1 approver (SBH) approves → moves to L2 ─────────────────────────
  (get_claim_status_id('L1_PENDING'),
   get_claim_status_id('L2_PENDING'),
   get_role_id('APPROVER_L1'),
   false, false, 'approved', null),

  -- ── 6. L1 approver rejects permanently (no resubmit) ────────────────────
  (get_claim_status_id('L1_PENDING'),
   get_claim_status_id('L1_REJECTED'),
   get_role_id('APPROVER_L1'),
   true, false, 'rejected', false),

  -- ── 7. L1 approver returns for correction (resubmit allowed) ────────────
  (get_claim_status_id('L1_PENDING'),
   get_claim_status_id('RETURNED_FOR_MODIFICATION'),
   get_role_id('APPROVER_L1'),
   true, false, 'rejected', true),

  -- ── 8. L2 approver (Mansoor/HOD) approves → moves to Finance ────────────
  (get_claim_status_id('L2_PENDING'),
   get_claim_status_id('L3_PENDING_FINANCE_REVIEW'),
   get_role_id('APPROVER_L2'),
   false, false, 'approved', null),

  -- ── 9. L2 approver rejects permanently ──────────────────────────────────
  (get_claim_status_id('L2_PENDING'),
   get_claim_status_id('L2_REJECTED'),
   get_role_id('APPROVER_L2'),
   true, false, 'rejected', false),

  -- ── 10. L2 approver returns for correction ───────────────────────────────
  (get_claim_status_id('L2_PENDING'),
   get_claim_status_id('RETURNED_FOR_MODIFICATION'),
   get_role_id('APPROVER_L2'),
   true, false, 'rejected', true),

  -- ── 11. Finance team issues payment → APPROVED ──────────────────────────
  (get_claim_status_id('L3_PENDING_FINANCE_REVIEW'),
   get_claim_status_id('APPROVED'),
   get_role_id('FINANCE_TEAM'),
   false, false, 'finance_issued', null),

  -- ── 12. Finance team rejects permanently ─────────────────────────────────
  (get_claim_status_id('L3_PENDING_FINANCE_REVIEW'),
   get_claim_status_id('L3_REJECTED_FINANCE'),
   get_role_id('FINANCE_TEAM'),
   true, false, 'finance_rejected', false),

  -- ── 13. Finance team returns for correction ──────────────────────────────
  (get_claim_status_id('L3_PENDING_FINANCE_REVIEW'),
   get_claim_status_id('RETURNED_FOR_MODIFICATION'),
   get_role_id('FINANCE_TEAM'),
   true, false, 'finance_rejected', true),

  -- ── 14–16. Employee resubmits after correction (RPC picks branch by designation) ─
  (get_claim_status_id('RETURNED_FOR_MODIFICATION'),
   get_claim_status_id('L1_PENDING'),
   get_role_id('EMPLOYEE'),
   false, false, 'resubmit', null),

  (get_claim_status_id('RETURNED_FOR_MODIFICATION'),
   get_claim_status_id('L2_PENDING'),
   get_role_id('EMPLOYEE'),
   false, false, 'resubmit', null),

  (get_claim_status_id('RETURNED_FOR_MODIFICATION'),
   get_claim_status_id('L3_PENDING_FINANCE_REVIEW'),
   get_role_id('EMPLOYEE'),
   false, false, 'resubmit', null),

  -- ── 17. Finance team reopens a finance-rejected claim ────────────────────
  (get_claim_status_id('L3_REJECTED_FINANCE'),
   get_claim_status_id('L3_PENDING_FINANCE_REVIEW'),
   get_role_id('FINANCE_TEAM'),
   false, false, 'reopened', null);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 7: Backfill expense_claims.status_id for any rows with NULL or stale values
--         Maps the current text status + approval level to the correct System B UUID
-- ─────────────────────────────────────────────────────────────────────────────
-- pending_approval at level 1 → L1_PENDING
UPDATE public.expense_claims
SET status_id = get_claim_status_id('L1_PENDING')
WHERE status = 'pending_approval'
  AND current_approval_level = 1
  AND (status_id IS NULL OR status_id != get_claim_status_id('L1_PENDING'));

-- pending_approval at level 2 → L2_PENDING
UPDATE public.expense_claims
SET status_id = get_claim_status_id('L2_PENDING')
WHERE status = 'pending_approval'
  AND current_approval_level = 2
  AND (status_id IS NULL OR status_id != get_claim_status_id('L2_PENDING'));

-- pending_approval at level 3 or finance_review → L3_PENDING_FINANCE_REVIEW
UPDATE public.expense_claims
SET status_id = get_claim_status_id('L3_PENDING_FINANCE_REVIEW')
WHERE status IN ('finance_review', 'pending_approval')
  AND (current_approval_level IS NULL OR current_approval_level = 3)
  AND status != 'pending_approval'
  AND (status_id IS NULL OR status_id != get_claim_status_id('L3_PENDING_FINANCE_REVIEW'));

-- finance_review (explicit)
UPDATE public.expense_claims
SET status_id = get_claim_status_id('L3_PENDING_FINANCE_REVIEW')
WHERE status = 'finance_review'
  AND (status_id IS NULL OR status_id != get_claim_status_id('L3_PENDING_FINANCE_REVIEW'));

-- issued → APPROVED (previously L4_ISSUED, same UUID after rename)
UPDATE public.expense_claims
SET status_id = get_claim_status_id('APPROVED')
WHERE status = 'issued'
  AND (status_id IS NULL OR status_id != get_claim_status_id('APPROVED'));

-- finance_rejected → L3_REJECTED_FINANCE
UPDATE public.expense_claims
SET status_id = get_claim_status_id('L3_REJECTED_FINANCE')
WHERE status = 'finance_rejected'
  AND (status_id IS NULL OR status_id != get_claim_status_id('L3_REJECTED_FINANCE'));

-- rejected → L1_REJECTED (level 1) or L2_REJECTED (level 2)
UPDATE public.expense_claims
SET status_id = get_claim_status_id('L1_REJECTED')
WHERE status = 'rejected'
  AND current_approval_level = 1
  AND (status_id IS NULL OR status_id != get_claim_status_id('L1_REJECTED'));

UPDATE public.expense_claims
SET status_id = get_claim_status_id('L2_REJECTED')
WHERE status = 'rejected'
  AND current_approval_level = 2
  AND (status_id IS NULL OR status_id != get_claim_status_id('L2_REJECTED'));

-- returned_for_modification
UPDATE public.expense_claims
SET status_id = get_claim_status_id('RETURNED_FOR_MODIFICATION')
WHERE status = 'returned_for_modification'
  AND (status_id IS NULL OR status_id != get_claim_status_id('RETURNED_FOR_MODIFICATION'));

-- submitted
UPDATE public.expense_claims
SET status_id = get_claim_status_id('SUBMITTED')
WHERE status = 'submitted'
  AND (status_id IS NULL OR status_id != get_claim_status_id('SUBMITTED'));

-- draft
UPDATE public.expense_claims
SET status_id = get_claim_status_id('DRAFT')
WHERE status = 'draft'
  AND (status_id IS NULL OR status_id != get_claim_status_id('DRAFT'));

COMMIT;
