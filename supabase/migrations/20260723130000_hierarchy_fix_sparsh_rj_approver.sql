-- Hierarchy changes 2026-07 — corrective: restore Sparsh Gupta's Rajasthan
-- level-1 approver.
--
-- WHY THIS FILE EXISTS
-- --------------------
-- The first version of 20260723110000 (Maharashtra) moved reports by pointer
-- alone: "everyone whose approval_employee_id_level_1 is Arka". Phase 2 creates
-- Sparsh Gupta — the new RAJASTHAN ABH — already pointing at Arka, because Arka
-- is his eventual RJ SBH. So the Maharashtra sweep took Sparsh with it and left
-- him reporting to Ashish Prakash Patil, the MAHARASHTRA SBH.
--
-- Nothing errors in that state. Sparsh can log in and submit; his claims simply
-- route to the wrong state's approver, and the only visible symptom is an
-- Ashish who holds one Rajasthan report.
--
-- 20260723110000 has since been corrected to filter on MH primary state, so a
-- database that has not yet run these migrations will never enter this state.
-- This file repairs one that already did.
--
-- ⚠ It is therefore expected to be a NO-OP on any database where the corrected
-- Maharashtra migration ran — including production. "0 rows" here is success,
-- not a failure. It is safe and correct to apply either way, which is why it is
-- a migration rather than a one-off manual fix.
--
-- Resolved by natural key and idempotent: re-running matches nobody.

DO $$
DECLARE
  v_sparsh uuid;
  v_arka uuid;
  v_current text;
  v_moved int;
BEGIN
  SELECT id INTO v_sparsh
  FROM public.employees WHERE lower(employee_email) = 'sparsh.gupta@nxtwave.co.in';

  SELECT id INTO v_arka
  FROM public.employees WHERE lower(employee_email) = 'arkaprabha.ghosh@nxtwave.co.in';

  -- A database that never ran Phase 2 has no Sparsh. That is not an error here;
  -- there is simply nothing to correct.
  IF v_sparsh IS NULL THEN
    RAISE NOTICE 'Sparsh Gupta not present; nothing to correct.';
    RETURN;
  END IF;

  IF v_arka IS NULL THEN
    RAISE EXCEPTION 'Arka Prabha Ghosh (the Rajasthan SBH) not found; cannot correct Sparsh Gupta.';
  END IF;

  SELECT coalesce(l1.employee_name, '(none)')
  INTO v_current
  FROM public.employees e
  LEFT JOIN public.employees l1 ON l1.id = e.approval_employee_id_level_1
  WHERE e.id = v_sparsh;

  UPDATE public.employees
  SET approval_employee_id_level_1 = v_arka,
      updated_at = now()
  WHERE id = v_sparsh
    AND approval_employee_id_level_1 IS DISTINCT FROM v_arka;

  GET DIAGNOSTICS v_moved = ROW_COUNT;

  IF v_moved = 0 THEN
    RAISE NOTICE 'Sparsh Gupta already reports to Arka Prabha Ghosh; no change needed.';
  ELSE
    RAISE NOTICE 'Corrected Sparsh Gupta: level-1 approver % -> Arka Prabha Ghosh.', v_current;
  END IF;

  -- ── Assert the invariant this whole correction is about: an SBH must not hold
  --    reports from a state they do not cover. ──
  IF EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.employees l1 ON l1.id = e.approval_employee_id_level_1
    JOIN public.employee_states es ON es.employee_id = e.id AND es.is_primary
    JOIN public.states s ON s.id = es.state_id
    WHERE lower(l1.employee_email) = 'ashish.prakashpatil@nxtwave.co.in'
      AND s.state_code <> 'MH'
  ) THEN
    RAISE EXCEPTION 'Ashish Prakash Patil still holds non-Maharashtra report(s).';
  END IF;
END $$;

-- Record the correction. version_number is GENERATED ALWAYS AS IDENTITY here,
-- which rejects an explicit value — and identity columns report
-- column_default = NULL, so the shape is detected at runtime rather than
-- assumed. See the Phase 2 migration for the full explanation.
DO $$
DECLARE
  v_tag     constant text := 'Hierarchy changes 2026-07 correction (Sparsh Gupta):';
  v_summary constant text := v_tag || ' level-1 approver restored to '
    'Arka Prabha Ghosh after the Maharashtra pointer sweep captured him. '
    'Maharashtra migration corrected to filter on MH primary state.';
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
