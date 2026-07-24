-- Hierarchy changes 2026-07 — Phase 3 step 4 of 5: TAMIL NADU.
-- Hari Haran S → Sreejish Mohana Kumar as the level-1 (SBH) approver,
-- TAMIL NADU REPORTS ONLY.
--
-- The second half of the Kerala/Tamil Nadu split (see 20260723110200). The state
-- filter is load-bearing for the same reason: without it this would sweep up any
-- Kerala report still pointing at Hari.
--
-- ⚠ Sreejish must be ACTIVE and hold APPROVER_L1 before this runs. He was
-- INACTIVE with the EMPLOYEE role only until the Phase 2 migration reversed his
-- earlier handover to Hari. Both halves matter and both are checked below:
-- an inactive approver cannot log in to reach the queue, and an approver without
-- APPROVER_L1 is rejected by submit_approval_action_atomic when they try to act.
-- Either failure would silently jam the entire Tamil Nadu queue.
--
-- ⚠ Deliberately a plain UPDATE, not admin_finalize_employee_replacement_atomic:
-- that RPC cannot express a state-filtered move, and it writes an
-- employee_replacements row that would let Sreejish inherit visibility of Hari's
-- Kerala approvals. Clean cut — see the Kerala migration header.
--
-- Idempotent: a re-run matches nobody and is a no-op.

DO $$
DECLARE
  v_old_sbh uuid;
  v_new_sbh uuid;
  v_status text;
  v_pending int;
  v_moved int;
BEGIN
  SELECT id INTO v_old_sbh
  FROM public.employees WHERE lower(employee_email) = 'hari.haran@nxtwave.co.in';

  SELECT id INTO v_new_sbh
  FROM public.employees WHERE lower(employee_email) = 'sreejish.mohanakumar@nxtwave.co.in';

  IF v_old_sbh IS NULL THEN
    RAISE EXCEPTION 'Outgoing KL/TN SBH (hari.haran@nxtwave.co.in) not found.';
  END IF;

  IF v_new_sbh IS NULL THEN
    RAISE EXCEPTION 'Incoming TN SBH (sreejish.mohanakumar@nxtwave.co.in) not found.';
  END IF;

  SELECT st.status_code INTO v_status
  FROM public.employees e
  JOIN public.employee_statuses st ON st.id = e.employee_status_id
  WHERE e.id = v_new_sbh;

  IF v_status <> 'ACTIVE' THEN
    RAISE EXCEPTION
      'Sreejish Mohana Kumar is %, not ACTIVE — he could not log in to reach the Tamil Nadu queue. Apply the Phase 2 migration first.',
      v_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employee_roles er
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.employee_id = v_new_sbh AND r.role_code = 'APPROVER_L1' AND er.is_active
  ) THEN
    RAISE EXCEPTION
      'Sreejish Mohana Kumar does not hold an active APPROVER_L1 role; every approval he attempted would be rejected. Apply the Phase 2 migration first.';
  END IF;

  -- ── DRAIN GATE — scoped to the TAMIL NADU reports only. ──
  SELECT count(*) INTO v_pending
  FROM public.expense_claims c
  JOIN public.employees owner ON owner.id = c.employee_id
  JOIN public.claim_statuses cs ON cs.id = c.status_id
  JOIN public.employee_states es ON es.employee_id = owner.id AND es.is_primary
  JOIN public.states s ON s.id = es.state_id
  WHERE owner.approval_employee_id_level_1 = v_old_sbh
    AND s.state_code = 'TN'
    AND cs.status_code = 'L1_PENDING';

  IF v_pending > 0 THEN
    RAISE EXCEPTION
      'Drain gate: Hari Haran S still has % Tamil Nadu claim(s) at L1_PENDING. He must clear them before the Tamil Nadu cutover.',
      v_pending;
  END IF;

  -- ── The move — Tamil Nadu primary-state reports only. ──
  UPDATE public.employees e
  SET approval_employee_id_level_1 = v_new_sbh,
      updated_at = now()
  FROM public.employee_states es
  JOIN public.states s ON s.id = es.state_id
  WHERE es.employee_id = e.id
    AND es.is_primary
    AND s.state_code = 'TN'
    AND e.approval_employee_id_level_1 = v_old_sbh;

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE 'Tamil Nadu: moved % report(s) from Hari Haran S to Sreejish Mohana Kumar.', v_moved;

  -- ── Post-condition: Hari should now hold nothing. If he still has reports,
  --    someone has a primary state that is neither KL nor TN and needs a manual
  --    decision before Phase 4 inactivates him. Surfaced as a NOTICE rather than
  --    an exception — the move that just happened is correct either way. ──
  SELECT count(*) INTO v_pending
  FROM public.employees WHERE approval_employee_id_level_1 = v_old_sbh;

  IF v_pending > 0 THEN
    RAISE NOTICE
      'ATTENTION: Hari Haran S still has % level-1 report(s) after both splits. Resolve before Phase 4 inactivates him.',
      v_pending;
  ELSE
    RAISE NOTICE 'Hari Haran S now has zero level-1 reports; he is ready for Phase 4.';
  END IF;
END $$;

-- Record the change as a config version. version_number is GENERATED ALWAYS AS
-- IDENTITY here, which rejects an explicit value — and identity columns report
-- column_default = NULL, so the shape is detected at runtime rather than
-- assumed. See the Phase 2 migration for the full explanation.
DO $$
DECLARE
  v_tag     constant text := 'Hierarchy changes 2026-07 Phase 3 step 4 (Tamil Nadu):';
  v_summary constant text := v_tag || ' level-1 approver moved from Hari Haran S '
    'to Sreejish Mohana Kumar for TN-primary reports only. Clean cut — no '
    'employee_replacements row.';
  v_autonumbered boolean;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.config_versions
    WHERE change_scope = 'employee_hierarchy'
      AND change_summary LIKE v_tag || '%'
  ) THEN
    RAISE NOTICE 'config_versions already records this change; skipping.';
    RETURN;
  END IF;

  SELECT (c.is_identity = 'YES' OR c.column_default IS NOT NULL)
  INTO v_autonumbered
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'config_versions'
    AND c.column_name = 'version_number';

  IF coalesce(v_autonumbered, false) THEN
    INSERT INTO public.config_versions (change_scope, change_summary)
    VALUES ('employee_hierarchy', v_summary);
  ELSE
    INSERT INTO public.config_versions (version_number, change_scope, change_summary)
    SELECT coalesce(max(version_number), 0) + 1, 'employee_hierarchy', v_summary
    FROM public.config_versions;
  END IF;
END $$;
