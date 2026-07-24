-- Hierarchy changes 2026-07 — Phase 3 step 2 of 5: RAJASTHAN.
-- Adarsh Anand Digal → Arka Prabha Ghosh as the level-1 (SBH) approver.
--
-- ⚠ MUST RUN AFTER 20260723110000 (Maharashtra). Arka has to be freed from the
-- Maharashtra queue before he takes Rajasthan, or he briefly owns both. This
-- migration verifies that ordering rather than trusting it.
--
-- ⚠ ADARSH IS HIS OWN LEVEL-1 APPROVER — a pre-existing self-loop in the data,
-- not something this change introduces. He is therefore inside his own report
-- set, and this migration moves him along with the other 8. The result is
-- "Adarsh's claims are approved by Arka", which is the intended end state: he
-- becomes an ABH in Phase 4, and an ABH's flow is [1,2,3], so he needs a real
-- stage-1 approver who is not himself. Calling that out explicitly because it
-- reads like an accident and is not one.
--
-- ⚠ Only approval_employee_id_level_1 is touched — never _level_2 (the ZBH, who
-- never acts) or _level_3 (the HOD, who acts at claim stage 2). See the
-- Maharashtra migration header for why the admin RPCs are unsuitable here.
--
-- Idempotent: a re-run matches nobody and is a no-op.

DO $$
DECLARE
  v_old_sbh uuid;
  v_new_sbh uuid;
  v_mh_remaining int;
  v_pending int;
  v_moved int;
BEGIN
  SELECT id INTO v_old_sbh
  FROM public.employees WHERE lower(employee_email) = 'adarshanand.digal@nxtwave.co.in';

  SELECT id INTO v_new_sbh
  FROM public.employees WHERE lower(employee_email) = 'arkaprabha.ghosh@nxtwave.co.in';

  IF v_old_sbh IS NULL THEN
    RAISE EXCEPTION 'Outgoing RJ SBH (adarshanand.digal@nxtwave.co.in) not found.';
  END IF;

  IF v_new_sbh IS NULL THEN
    RAISE EXCEPTION 'Incoming RJ SBH (arkaprabha.ghosh@nxtwave.co.in) not found.';
  END IF;

  -- ── Ordering guard: Arka must already be out of Maharashtra. Any remaining
  --    MH-primary report pointing at him means step 1 has not been applied. ──
  SELECT count(*) INTO v_mh_remaining
  FROM public.employees e
  JOIN public.employee_states es ON es.employee_id = e.id AND es.is_primary
  JOIN public.states s ON s.id = es.state_id
  WHERE e.approval_employee_id_level_1 = v_new_sbh
    AND s.state_code = 'MH';

  IF v_mh_remaining > 0 THEN
    RAISE EXCEPTION
      'Ordering violation: Arka still has % Maharashtra report(s). Apply 20260723110000 (Maharashtra) first, or he owns two states at once.',
      v_mh_remaining;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employee_roles er
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.employee_id = v_new_sbh AND r.role_code = 'APPROVER_L1' AND er.is_active
  ) THEN
    RAISE EXCEPTION 'Arka Prabha Ghosh does not hold an active APPROVER_L1 role; he could not action the queue.';
  END IF;

  -- ── DRAIN GATE. L1_PENDING only; see the Maharashtra migration for why
  --    L2_PENDING and DRAFT claims are unaffected by a level-1 pointer swap. ──
  SELECT count(*) INTO v_pending
  FROM public.expense_claims c
  JOIN public.employees owner ON owner.id = c.employee_id
  JOIN public.claim_statuses cs ON cs.id = c.status_id
  WHERE owner.approval_employee_id_level_1 = v_old_sbh
    AND cs.status_code = 'L1_PENDING';

  IF v_pending > 0 THEN
    RAISE EXCEPTION
      'Drain gate: Adarsh Anand Digal still has % claim(s) at L1_PENDING. He must clear his queue before the Rajasthan cutover.',
      v_pending;
  END IF;

  -- ── The move. Includes Adarsh himself, by design (see header). ──
  UPDATE public.employees
  SET approval_employee_id_level_1 = v_new_sbh,
      updated_at = now()
  WHERE approval_employee_id_level_1 = v_old_sbh;

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE 'Rajasthan: moved % report(s) from Adarsh Anand Digal to Arka Prabha Ghosh (Adarsh included).', v_moved;
END $$;

-- Record the change as a config version. version_number is GENERATED ALWAYS AS
-- IDENTITY here, which rejects an explicit value — and identity columns report
-- column_default = NULL, so the shape is detected at runtime rather than
-- assumed. See the Phase 2 migration for the full explanation.
DO $$
DECLARE
  v_tag     constant text := 'Hierarchy changes 2026-07 Phase 3 step 2 (Rajasthan):';
  v_summary constant text := v_tag || ' level-1 approver moved from '
    'Adarsh Anand Digal to Arka Prabha Ghosh.';
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
