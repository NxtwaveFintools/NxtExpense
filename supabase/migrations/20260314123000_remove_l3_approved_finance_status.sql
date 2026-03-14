BEGIN;

DO $cleanup$
DECLARE
  v_legacy_id uuid;
  v_ref_count integer;
BEGIN
  SELECT id INTO v_legacy_id
  FROM public.claim_statuses
  WHERE status_code = 'L3_APPROVED_FINANCE';

  IF v_legacy_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    (SELECT count(*) FROM public.expense_claims WHERE status_id = v_legacy_id)
    +
    (SELECT count(*) FROM public.claim_status_transitions WHERE from_status_id = v_legacy_id OR to_status_id = v_legacy_id)
    +
    (SELECT count(*) FROM public.approval_history WHERE old_status_id = v_legacy_id OR new_status_id = v_legacy_id)
    +
    (SELECT count(*) FROM public.claim_approvals WHERE old_status_id = v_legacy_id OR new_status_id = v_legacy_id)
  INTO v_ref_count;

  IF v_ref_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete L3_APPROVED_FINANCE: % dependent row(s) still reference it.', v_ref_count;
  END IF;

  DELETE FROM public.claim_statuses
  WHERE id = v_legacy_id;
END;
$cleanup$;

COMMIT;
