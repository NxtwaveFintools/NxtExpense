-- Hierarchy changes 2026-07 — Phase 3 step 3 of 5: KERALA.
-- Hari Haran S → Jijo Varghese as the level-1 (SBH) approver, KERALA REPORTS ONLY.
--
-- ⚠ THIS IS A SPLIT, NOT A SWAP. Hari covers two states and is being replaced by
-- two different people: Jijo takes Kerala (this migration), Sreejish takes Tamil
-- Nadu (the next one). The STATE FILTER IS LOAD-BEARING — without it this
-- statement would hand Hari's entire team, Tamil Nadu included, to Jijo.
--
-- ⚠ This is also why the built-in Replace flow cannot be used.
-- admin_finalize_employee_replacement_atomic does a blanket
-- "UPDATE ... WHERE approval_employee_id_level_1 = old" with no state filter —
-- it can only move all of somebody's reports to one successor. A split needs a
-- filtered UPDATE, which means a migration.
--
-- ⚠ It writes an employee_replacements row as a side effect too, and
-- get_my_approver_acted_claim_ids walks that table recursively. Using it would
-- give Jijo visibility of Hari's past Tamil Nadu approvals — cross-state leakage.
-- The agreed model is a clean cut: neither successor inherits Hari's history,
-- each sees only what they action from cutover onward. Hari's own history stays
-- fully visible to Finance and Admin, so nothing is lost from the audit trail.
-- Hence: a plain UPDATE, and no employee_replacements row.
--
-- The filter matches the report's PRIMARY state. Hari's Kerala reports are the
-- 3 SROs and 1 ABH whose primary state is KL.
--
-- Idempotent: a re-run matches nobody and is a no-op.

DO $$
DECLARE
  v_old_sbh uuid;
  v_new_sbh uuid;
  v_pending int;
  v_moved int;
BEGIN
  SELECT id INTO v_old_sbh
  FROM public.employees WHERE lower(employee_email) = 'hari.haran@nxtwave.co.in';

  SELECT id INTO v_new_sbh
  FROM public.employees WHERE lower(employee_email) = 'jijo.varghese@nxtwave.co.in';

  IF v_old_sbh IS NULL THEN
    RAISE EXCEPTION 'Outgoing KL/TN SBH (hari.haran@nxtwave.co.in) not found.';
  END IF;

  IF v_new_sbh IS NULL THEN
    RAISE EXCEPTION
      'Incoming KL SBH (jijo.varghese@nxtwave.co.in) not found. Apply the Phase 2 migration first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employee_roles er
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.employee_id = v_new_sbh AND r.role_code = 'APPROVER_L1' AND er.is_active
  ) THEN
    RAISE EXCEPTION 'Jijo Varghese does not hold an active APPROVER_L1 role; he could not action the queue.';
  END IF;

  -- ────────────────────────────────────────────────────────────────────────
  -- DRAIN GATE — scoped to the KERALA reports only.
  --
  -- Hari's Tamil Nadu queue is checked separately by the next migration. Scoping
  -- per state rather than gating on his whole queue means Kerala can cut over as
  -- soon as Kerala is clear, and a half-finished cutover is still a correct,
  -- stable resting state. Any Tamil Nadu claim still pending stays with Hari,
  -- which is exactly the agreed behaviour.
  --
  -- L1_PENDING only: claims at L2_PENDING resolve against
  -- approval_employee_id_level_3 (the HOD), which this migration does not touch.
  -- ────────────────────────────────────────────────────────────────────────
  SELECT count(*) INTO v_pending
  FROM public.expense_claims c
  JOIN public.employees owner ON owner.id = c.employee_id
  JOIN public.claim_statuses cs ON cs.id = c.status_id
  JOIN public.employee_states es ON es.employee_id = owner.id AND es.is_primary
  JOIN public.states s ON s.id = es.state_id
  WHERE owner.approval_employee_id_level_1 = v_old_sbh
    AND s.state_code = 'KL'
    AND cs.status_code = 'L1_PENDING';

  IF v_pending > 0 THEN
    RAISE EXCEPTION
      'Drain gate: Hari Haran S still has % Kerala claim(s) at L1_PENDING. He must clear them before the Kerala cutover.',
      v_pending;
  END IF;

  -- ── The move — Kerala primary-state reports only. ──
  UPDATE public.employees e
  SET approval_employee_id_level_1 = v_new_sbh,
      updated_at = now()
  FROM public.employee_states es
  JOIN public.states s ON s.id = es.state_id
  WHERE es.employee_id = e.id
    AND es.is_primary
    AND s.state_code = 'KL'
    AND e.approval_employee_id_level_1 = v_old_sbh;

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE 'Kerala: moved % report(s) from Hari Haran S to Jijo Varghese.', v_moved;

  IF v_moved = 0 THEN
    RAISE NOTICE 'No rows moved — already applied, or no KL-primary reports point at Hari.';
  END IF;
END $$;

-- Record the change as a config version. version_number is GENERATED ALWAYS AS
-- IDENTITY here, which rejects an explicit value — and identity columns report
-- column_default = NULL, so the shape is detected at runtime rather than
-- assumed. See the Phase 2 migration for the full explanation.
DO $$
DECLARE
  v_tag     constant text := 'Hierarchy changes 2026-07 Phase 3 step 3 (Kerala):';
  v_summary constant text := v_tag || ' level-1 approver moved from Hari Haran S '
    'to Jijo Varghese for KL-primary reports only. Clean cut — no '
    'employee_replacements row, so no approval-history inheritance.';
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
