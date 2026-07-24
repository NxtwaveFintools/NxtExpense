-- Hierarchy changes 2026-07 — Phase 3 step 1 of 5: MAHARASHTRA.
-- Arka Prabha Ghosh → Ashish Prakash Patil as the level-1 (SBH) approver.
--
-- ⚠ THIS MUST RUN BEFORE 20260723110100 (Rajasthan). Arka is both an outgoing
-- SBH (Maharashtra) and an incoming one (Rajasthan). If Rajasthan went first he
-- would briefly own both states' queues.
--
-- ⚠ STATE-FILTERED, like every other step in this phase. An earlier draft swept
-- by pointer alone — "everyone whose level_1 is Arka" — on the reasoning that
-- the Maharashtra team had no employee_states rows to filter on. That was true
-- of the ORIGINAL team but wrong by the time this migration runs, and it caused
-- a real defect:
--
--   Phase 2 creates Sparsh Gupta (the new RAJASTHAN ABH) already pointing at
--   Arka, because Arka is his eventual RJ SBH. An unfiltered sweep on that
--   pointer moves Sparsh to the MAHARASHTRA SBH along with the MH team. His
--   claims would then route to the wrong state's approver — no error, no crash,
--   just a silently misrouted approval chain.
--
-- The premise no longer holds either: Phase 2 backfills the MH team with an MH
-- primary state BEFORE this migration runs, so the state IS available to filter
-- on. Filtering restores the invariant every other step relies on — a state
-- cutover only ever touches that state's people.
--
-- The guard below makes the dependency explicit rather than assumed: if anyone
-- pointing at Arka still has no primary state, the filter would silently skip
-- them, so we refuse to run instead.
--
-- ⚠ ONLY approval_employee_id_level_1 is touched. _level_2 (ZBH — never acts,
-- read-only visibility) and _level_3 (the HOD, who acts at claim stage 2) are
-- left alone. Do NOT route this through admin_reassign_employee_approvers_atomic:
-- that RPC sets all three levels unconditionally, so passing only L1 would wipe
-- the HOD to NULL and strand every claim sitting at stage 2.
--
-- ⚠ Do NOT use admin_finalize_employee_replacement_atomic either. It does a
-- blanket unfiltered UPDATE and writes an employee_replacements row as a side
-- effect, which would grant the successor visibility of the predecessor's past
-- approvals — the opposite of the agreed clean cut.
--
-- Idempotent: a re-run matches nobody (they already point at Ashish) and is a
-- no-op, not an error.

DO $$
DECLARE
  v_old_sbh uuid;
  v_new_sbh uuid;
  v_pending int;
  v_moved int;
  v_stateless int;
BEGIN
  SELECT id INTO v_old_sbh
  FROM public.employees WHERE lower(employee_email) = 'arkaprabha.ghosh@nxtwave.co.in';

  SELECT id INTO v_new_sbh
  FROM public.employees WHERE lower(employee_email) = 'ashish.prakashpatil@nxtwave.co.in';

  IF v_old_sbh IS NULL THEN
    RAISE EXCEPTION 'Outgoing MH SBH (arkaprabha.ghosh@nxtwave.co.in) not found.';
  END IF;

  IF v_new_sbh IS NULL THEN
    RAISE EXCEPTION
      'Incoming MH SBH (ashish.prakashpatil@nxtwave.co.in) not found. Apply the Phase 2 migration first.';
  END IF;

  -- ── Guard: the incoming SBH must be able to act on the queue he is about to
  --    inherit. Without an active APPROVER_L1 role, submit_approval_action_atomic
  --    refuses every approval he attempts and the queue silently jams. ──
  IF NOT EXISTS (
    SELECT 1 FROM public.employee_roles er
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.employee_id = v_new_sbh AND r.role_code = 'APPROVER_L1' AND er.is_active
  ) THEN
    RAISE EXCEPTION 'Ashish Prakash Patil does not hold an active APPROVER_L1 role; he could not action the queue.';
  END IF;

  -- ────────────────────────────────────────────────────────────────────────
  -- DRAIN GATE.
  --
  -- Agreed rule: existing claims stay with their original approver; only new
  -- claims follow the new configuration. Because the approver is resolved LIVE
  -- from the owner's row, swapping the pointer while claims sit in L1_PENDING
  -- would hand those claims to the new approver mid-flight. Refusing to run is
  -- what enforces that rule — it is a mechanism, not a checklist item.
  --
  -- The gate is L1_PENDING ONLY, and that is not an oversight. A claim at
  -- L2_PENDING is checked against approval_employee_id_level_3 (the HOD), which
  -- this migration does not touch, so it cannot be affected. DRAFT claims are
  -- likewise fine: they resolve their approver at submit time and will correctly
  -- pick up the new configuration.
  -- ────────────────────────────────────────────────────────────────────────
  SELECT count(*) INTO v_pending
  FROM public.expense_claims c
  JOIN public.employees owner ON owner.id = c.employee_id
  JOIN public.claim_statuses cs ON cs.id = c.status_id
  WHERE owner.approval_employee_id_level_1 = v_old_sbh
    AND cs.status_code = 'L1_PENDING';

  IF v_pending > 0 THEN
    RAISE EXCEPTION
      'Drain gate: Arka Prabha Ghosh still has % claim(s) at L1_PENDING. He must clear his queue before the Maharashtra cutover.',
      v_pending;
  END IF;

  -- ── Guard: the state filter below is only trustworthy if everyone pointing at
  --    Arka actually has a primary state. Anyone without one would be silently
  --    skipped and left behind on an outgoing approver. Phase 2's backfill is
  --    what guarantees this; fail loudly if it did not run. ──
  SELECT count(*) INTO v_stateless
  FROM public.employees e
  WHERE e.approval_employee_id_level_1 = v_old_sbh
    AND NOT EXISTS (
      SELECT 1 FROM public.employee_states es
      WHERE es.employee_id = e.id AND es.is_primary
    );

  IF v_stateless > 0 THEN
    RAISE EXCEPTION
      '% report(s) under Arka have no primary state; the MH filter would silently skip them. Apply the Phase 2 migration (which backfills MH) first.',
      v_stateless;
  END IF;

  -- ── The move — Maharashtra primary-state reports only.
  --    Sparsh Gupta (RJ primary) points at Arka by design and is correctly
  --    excluded here; he stays with Arka, who becomes the RJ SBH in step 2. ──
  UPDATE public.employees e
  SET approval_employee_id_level_1 = v_new_sbh,
      updated_at = now()
  FROM public.employee_states es
  JOIN public.states s ON s.id = es.state_id
  WHERE es.employee_id = e.id
    AND es.is_primary
    AND s.state_code = 'MH'
    AND e.approval_employee_id_level_1 = v_old_sbh;

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE 'Maharashtra: moved % report(s) from Arka Prabha Ghosh to Ashish Prakash Patil.', v_moved;

  -- ── Post-condition: no non-MH report may have been caught. ──
  SELECT count(*) INTO v_stateless
  FROM public.employees e
  JOIN public.employee_states es ON es.employee_id = e.id AND es.is_primary
  JOIN public.states s ON s.id = es.state_id
  WHERE e.approval_employee_id_level_1 = v_new_sbh
    AND s.state_code <> 'MH';

  IF v_stateless > 0 THEN
    RAISE EXCEPTION
      'Post-condition failed: Ashish Prakash Patil holds % non-Maharashtra report(s).',
      v_stateless;
  END IF;
END $$;

-- Record the change as a config version. version_number is GENERATED ALWAYS AS
-- IDENTITY here, which rejects an explicit value — and identity columns report
-- column_default = NULL, so the shape is detected at runtime rather than
-- assumed. See the Phase 2 migration for the full explanation.
DO $$
DECLARE
  v_tag     constant text := 'Hierarchy changes 2026-07 Phase 3 step 1 (Maharashtra):';
  v_summary constant text := v_tag || ' level-1 approver moved from '
    'Arka Prabha Ghosh to Ashish Prakash Patil.';
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
