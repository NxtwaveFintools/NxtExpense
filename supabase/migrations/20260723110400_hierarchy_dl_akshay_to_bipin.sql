-- Hierarchy changes 2026-07 — Phase 3 step 5 of 5: DELHI NCR.
-- Akshay Kumar Pal → Bipin Chandra Sati as the level-1 (SBH) approver,
-- DELHI NCR REPORTS ONLY.
--
-- ⚠ AKSHAY IS NOT BEING REPLACED — he is being narrowed. He covers Delhi NCR AND
-- Uttar Pradesh; Bipin takes Delhi NCR only. Akshay stays an ACTIVE SBH and keeps
-- the entire Uttar Pradesh team. A blanket replace would wrongly hand the UP
-- staff to Bipin, which is why this is a state-filtered migration and not the
-- admin Replace flow. The state filter is the whole point of this file.
--
-- Nilesh Tiwari, the new UP ABH created in Phase 2, slots under Akshay and is
-- untouched here — his primary state is UP, so the filter excludes him.
--
-- ⚠ Only approval_employee_id_level_1 is touched. _level_2 and _level_3 are left
-- alone; see the Maharashtra migration header for why the admin RPCs are unsafe.
--
-- Idempotent: a re-run matches nobody and is a no-op.

DO $$
DECLARE
  v_old_sbh uuid;
  v_new_sbh uuid;
  v_pending int;
  v_moved int;
  v_up_remaining int;
BEGIN
  SELECT id INTO v_old_sbh
  FROM public.employees WHERE lower(employee_email) = 'akshaykumar.pal@nxtwave.co.in';

  SELECT id INTO v_new_sbh
  FROM public.employees WHERE lower(employee_email) = 'bipin.sati@nxtwave.co.in';

  IF v_old_sbh IS NULL THEN
    RAISE EXCEPTION 'Outgoing DL SBH (akshaykumar.pal@nxtwave.co.in) not found.';
  END IF;

  IF v_new_sbh IS NULL THEN
    RAISE EXCEPTION
      'Incoming DL SBH (bipin.sati@nxtwave.co.in) not found. Apply the Phase 2 migration first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employee_roles er
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.employee_id = v_new_sbh AND r.role_code = 'APPROVER_L1' AND er.is_active
  ) THEN
    RAISE EXCEPTION 'Bipin Chandra Sati does not hold an active APPROVER_L1 role; he could not action the queue.';
  END IF;

  -- ── DRAIN GATE — scoped to the DELHI NCR reports only.
  --    Akshay keeps Uttar Pradesh, so his UP queue is irrelevant to this cutover
  --    and must not block it. ──
  SELECT count(*) INTO v_pending
  FROM public.expense_claims c
  JOIN public.employees owner ON owner.id = c.employee_id
  JOIN public.claim_statuses cs ON cs.id = c.status_id
  JOIN public.employee_states es ON es.employee_id = owner.id AND es.is_primary
  JOIN public.states s ON s.id = es.state_id
  WHERE owner.approval_employee_id_level_1 = v_old_sbh
    AND s.state_code = 'DL'
    AND cs.status_code = 'L1_PENDING';

  IF v_pending > 0 THEN
    RAISE EXCEPTION
      'Drain gate: Akshay Kumar Pal still has % Delhi NCR claim(s) at L1_PENDING. He must clear them before the Delhi NCR cutover.',
      v_pending;
  END IF;

  -- ── The move — Delhi NCR primary-state reports only. ──
  UPDATE public.employees e
  SET approval_employee_id_level_1 = v_new_sbh,
      updated_at = now()
  FROM public.employee_states es
  JOIN public.states s ON s.id = es.state_id
  WHERE es.employee_id = e.id
    AND es.is_primary
    AND s.state_code = 'DL'
    AND e.approval_employee_id_level_1 = v_old_sbh;

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE 'Delhi NCR: moved % report(s) from Akshay Kumar Pal to Bipin Chandra Sati.', v_moved;

  -- ── Post-condition: Akshay must STILL have his Uttar Pradesh team. Zero here
  --    would mean the state filter failed and everyone went to Bipin — the exact
  --    failure this migration exists to prevent. Worth failing the transaction
  --    over, because it is silent otherwise. ──
  SELECT count(*) INTO v_up_remaining
  FROM public.employees e
  JOIN public.employee_states es ON es.employee_id = e.id AND es.is_primary
  JOIN public.states s ON s.id = es.state_id
  WHERE e.approval_employee_id_level_1 = v_old_sbh
    AND s.state_code = 'UP';

  IF v_up_remaining = 0 THEN
    RAISE EXCEPTION
      'Post-condition failed: Akshay Kumar Pal has no Uttar Pradesh reports left. He was supposed to keep them.';
  END IF;

  RAISE NOTICE 'Akshay Kumar Pal retains % Uttar Pradesh report(s), as intended.', v_up_remaining;
END $$;

-- Record the change as a config version. version_number is GENERATED ALWAYS AS
-- IDENTITY here, which rejects an explicit value — and identity columns report
-- column_default = NULL, so the shape is detected at runtime rather than
-- assumed. See the Phase 2 migration for the full explanation.
DO $$
DECLARE
  v_tag     constant text := 'Hierarchy changes 2026-07 Phase 3 step 5 (Delhi NCR):';
  v_summary constant text := v_tag || ' level-1 approver moved from '
    'Akshay Kumar Pal to Bipin Chandra Sati for DL-primary reports only. '
    'Akshay stays an active SBH and keeps Uttar Pradesh.';
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
