-- Hierarchy changes 2026-07 — Phase 2: create the new joiners, repair 3 existing records.
--
-- Source: NxtExpense_Tool_Higherachy_Changes sheet, tabs New_Employees + Higherachy_Changes.
-- Design notes and decisions: docs/hierarchy-changes-2026-07-findings.md
--
-- WHY THIS PHASE IS INERT
-- -----------------------
-- Approval routing is resolved live from three denormalized columns on the claim
-- OWNER's row (approval_employee_id_level_1/_2/_3). Nothing here repoints an
-- existing employee at a new approver, so no claim changes hands and no queue
-- moves. New rows have zero reports, which means:
--   * no /approvals tab for them (hasApproverAssignments is derived from
--     "does anyone point at me", not from a stored flag),
--   * no effect on any in-flight claim.
-- The people can log in (Microsoft SSO — an employees row is all that is needed)
-- and submit their own claims from the moment this lands. Pointer moves are
-- Phase 3, in separate per-state migrations.
--
-- ⚠ LEVEL NAMING IS OFF BY ONE. A claim at current_approval_level = 2 is checked
-- against approval_employee_id_level_3, not _level_2. Confirmed in
-- submit_approval_action_atomic. The mapping actually is:
--     _level_1 = SBH   → acts at stage 1, needs role APPROVER_L1
--     _level_2 = ZBH   → NEVER acts; read-only visibility in pending_approvals_filtered
--     _level_3 = HOD   → acts at stage 2, needs role APPROVER_L2
-- So every new row gets _level_3 = Mansoor, and _level_2 = the ZBH of their state.
--
-- ⚠ SBHs get _level_1 = NULL BY DESIGN. designation_approval_flow gives SBH the
-- flow [2,3], so their own claims start at stage 2 and go direct to the HOD. An
-- SBH cannot approve themselves.
--
-- ⚠ Every new SBH needs the APPROVER_L1 role. The L1_PENDING → L2_PENDING
-- transition carries requires_role_id = APPROVER_L1, and
-- submit_approval_action_atomic rejects the action without it. The role is not
-- cosmetic; without it the person owns a queue they cannot action.
--
-- This migration is written to be idempotent: re-running it is a no-op, not an
-- error and not a data change. Everything resolves by natural key
-- (employee_id / employee_email / designation_code / state_code / role_code) —
-- never by hard-coded UUID, because the UUIDs differ between dev and production.

DO $$
DECLARE
  v_missing text;
  v_count int;
BEGIN
  -- ────────────────────────────────────────────────────────────────────────
  -- 0. Preflight. Fail loudly and BEFORE any write if an anchor person or a
  --    reference row is missing, rather than silently inserting NULL approvers.
  --    A new employee with a NULL _level_1 who needs one is not a cosmetic
  --    problem: shouldBlockForMissingLevel1Approver refuses their submissions
  --    outright.
  -- ────────────────────────────────────────────────────────────────────────
  SELECT string_agg(expected.email, ', ')
  INTO v_missing
  FROM (
    VALUES
      ('mansoor@nxtwave.co.in'),                    -- HOD, _level_3 for everyone
      ('satyapriya.dash@nxtwave.co.in'),            -- ZBH for DL/RJ/UP/WB/OD
      ('harisanthosh.tibirisetty@nxtwave.co.in'),   -- ZBH for KA/MH
      ('akshaykumar.pal@nxtwave.co.in'),            -- L1 for the new UP ABH
      ('arkaprabha.ghosh@nxtwave.co.in'),           -- L1 for the new RJ ABH
      ('sreejish.mohanakumar@nxtwave.co.in')        -- L1 for the two new TN ABHs
  ) AS expected(email)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE lower(e.employee_email) = expected.email
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 2 preflight failed: anchor employee(s) not found: %', v_missing;
  END IF;

  SELECT string_agg(expected.code, ', ')
  INTO v_missing
  FROM (VALUES ('TN'),('KL'),('KA'),('MH'),('RJ'),('DL'),('UP')) AS expected(code)
  WHERE NOT EXISTS (SELECT 1 FROM public.states s WHERE s.state_code = expected.code);

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 2 preflight failed: state code(s) not found: %', v_missing;
  END IF;

  --    The ON CONFLICT clauses below name specific unique constraints. If a
  --    target database is missing one, Postgres reports only "no unique or
  --    exclusion constraint matching the ON CONFLICT specification", which does
  --    not say which table. Check them up front so the message names the gap.
  SELECT string_agg(expected.label, ', ')
  INTO v_missing
  FROM (
    VALUES
      ('employees.employee_email',            'public.employees'::regclass,        ARRAY['employee_email']),
      ('employee_states(employee_id,state_id)','public.employee_states'::regclass, ARRAY['employee_id','state_id']),
      ('employee_roles(employee_id,role_id)', 'public.employee_roles'::regclass,   ARRAY['employee_id','role_id'])
  ) AS expected(label, tbl, cols)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    WHERE con.conrelid = expected.tbl
      AND con.contype IN ('u', 'p')
      AND (
        SELECT array_agg(att.attname::text ORDER BY att.attname)
        FROM unnest(con.conkey) AS k(attnum)
        JOIN pg_attribute att
          ON att.attrelid = con.conrelid AND att.attnum = k.attnum
      ) = (SELECT array_agg(c ORDER BY c) FROM unnest(expected.cols) AS c)
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION
      'Phase 2 preflight failed: required unique constraint(s) missing: %. The ON CONFLICT clauses in this migration depend on them.',
      v_missing;
  END IF;

  -- ────────────────────────────────────────────────────────────────────────
  -- 1. Sreejish Mohana Kumar (NW0000744) — bring him back as the Tamil Nadu SBH.
  --
  --    He is currently INACTIVE and holds the EMPLOYEE role only; he was handed
  --    over to Hari Haran previously. Reversing that needs BOTH halves:
  --      * INACTIVE → ACTIVE. getEmployeeByEmail filters on ACTIVE, so an
  --        inactive employee cannot log in at all (they land on /no-access).
  --        This is a hard blocker for him taking the TN queue, not cosmetic.
  --      * re-grant APPROVER_L1, or submit_approval_action_atomic refuses
  --        every approval he attempts.
  --    His employee_states are currently KL primary + TN secondary — backwards
  --    for his new role. TN is promoted; KL is DEMOTED rather than deleted, so
  --    the rollback is a flag flip and no membership is lost.
  -- ────────────────────────────────────────────────────────────────────────
  --    Matched on EMAIL, not employee_id. The employee_id values in this file
  --    were read off the dev database; email is the key that is guaranteed
  --    stable across environments (it is also the login identity and carries a
  --    UNIQUE constraint). Matching on a dev-only employee_id would make this a
  --    silent no-op on any database where that id differs.
  UPDATE public.employees e
  SET employee_status_id = (
        SELECT id FROM public.employee_statuses WHERE status_code = 'ACTIVE'
      ),
      updated_at = now()
  WHERE lower(e.employee_email) = 'sreejish.mohanakumar@nxtwave.co.in'
    AND e.employee_status_id IS DISTINCT FROM (
      SELECT id FROM public.employee_statuses WHERE status_code = 'ACTIVE'
    );

  INSERT INTO public.employee_roles (employee_id, role_id, is_active)
  SELECT e.id, r.id, true
  FROM public.employees e
  CROSS JOIN public.roles r
  WHERE lower(e.employee_email) = 'sreejish.mohanakumar@nxtwave.co.in'
    AND r.role_code = 'APPROVER_L1'
  ON CONFLICT (employee_id, role_id) DO UPDATE SET is_active = true;

  -- ────────────────────────────────────────────────────────────────────────
  -- 2. Muhammed Hijas — Intern → Employee ID conversion (NW1006377 → NW0007045).
  --
  --    ⚠ Matched on EMAIL and "not already correct", NOT on the old id.
  --    An earlier version matched WHERE employee_id = 'NW1006377' — a value read
  --    off the dev database. On any database where his old id differs, that
  --    predicate matches nothing, the conversion silently does not happen, and
  --    no later assertion catches it: every other check in this migration keys
  --    on email, so the wrong employee_id sails straight through. Matching on
  --    email removes the environment dependency; IS DISTINCT FROM keeps it
  --    idempotent.
  --
  --    Note: claim_number is stored text, generated at submit time. His existing
  --    claims keep their old CLAIM-<old id>-… prefix forever and only new ones
  --    use the new prefix. Two prefixes in his history is expected, not a defect.
  -- ────────────────────────────────────────────────────────────────────────
  UPDATE public.employees
  SET employee_id = 'NW0007045',
      updated_at = now()
  WHERE lower(employee_email) = 'muhammed.hijas@nxtwave.co.in'
    AND employee_id IS DISTINCT FROM 'NW0007045';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE NOTICE 'Muhammed Hijas already holds NW0007045 (or is absent); no conversion needed.';
  ELSE
    RAISE NOTICE 'Muhammed Hijas converted to employee ID NW0007045.';
  END IF;

  -- ────────────────────────────────────────────────────────────────────────
  -- 3. Maharashtra state backfill — a pre-existing data hole, fixed while we
  --    are in here.
  --
  --    Arka's reports (the MH team) have ZERO rows in employee_states, and Arka
  --    himself had none either. "Maharashtra" as an org unit only existed
  --    implicitly, via "who points at Arka at level 1".
  --
  --    Selected BY POINTER, not by name: at this instant Arka's level-1 reports
  --    are exactly the MH team, and the pointer is the authoritative fact. The
  --    NOT EXISTS guard means anyone who already has a state mapping is left
  --    alone — we only fill holes, never overwrite an existing primary.
  --
  --    This must run BEFORE Phase 3 step 1 moves those reports to Ashish;
  --    afterwards the pointer no longer identifies the MH team.
  -- ────────────────────────────────────────────────────────────────────────
  INSERT INTO public.employee_states (employee_id, state_id, is_primary)
  SELECT e.id, s.id, true
  FROM public.employees e
  JOIN public.employees arka
    ON arka.id = e.approval_employee_id_level_1
   AND lower(arka.employee_email) = 'arkaprabha.ghosh@nxtwave.co.in'
  CROSS JOIN public.states s
  WHERE s.state_code = 'MH'
    AND NOT EXISTS (
      SELECT 1 FROM public.employee_states es WHERE es.employee_id = e.id
    )
  ON CONFLICT (employee_id, state_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled MH primary state for % employee(s) under Arka.', v_count;

  -- ────────────────────────────────────────────────────────────────────────
  -- 4. Insert the 4 new SBHs FIRST.
  --
  --    Order matters: the ABHs in step 6 resolve their _level_1 by looking these
  --    rows up by email. Ashish must exist before Prathamesh points at him.
  --
  --    _level_1 is NULL for all four (SBH flow [2,3] — direct to HOD).
  --    _level_2 is the ZBH of their state; NULL for TN/KL, which matches what
  --    Hari Haran has today. That column never gates an approval, so NULL there
  --    costs nothing — it only removes a read-only visibility path.
  -- ────────────────────────────────────────────────────────────────────────
  INSERT INTO public.employees (
    employee_id, employee_name, employee_email, designation_id, employee_status_id,
    approval_employee_id_level_1, approval_employee_id_level_2, approval_employee_id_level_3
  )
  SELECT
    spec.employee_id,
    spec.employee_name,
    spec.employee_email,
    d.id,
    st.id,
    NULL,               -- SBH: no stage-1 approver by design
    zbh.id,
    hod.id
  FROM (
    VALUES
      ('NW0007185', 'Ashish Prakash Patil', 'ashish.prakashpatil@nxtwave.co.in', 'harisanthosh.tibirisetty@nxtwave.co.in'),
      ('NW0006996', 'Bipin Chandra Sati',   'bipin.sati@nxtwave.co.in',          'satyapriya.dash@nxtwave.co.in'),
      ('NW0000747', 'Jijo Varghese',        'jijo.varghese@nxtwave.co.in',       NULL),
      ('NW0007097', 'Nithin K',             'nithin.k@nxtwave.co.in',            'harisanthosh.tibirisetty@nxtwave.co.in')
  ) AS spec(employee_id, employee_name, employee_email, zbh_email)
  JOIN public.designations d ON d.designation_code = 'SBH'
  JOIN public.employee_statuses st ON st.status_code = 'ACTIVE'
  JOIN public.employees hod ON lower(hod.employee_email) = 'mansoor@nxtwave.co.in'
  LEFT JOIN public.employees zbh ON lower(zbh.employee_email) = spec.zbh_email
  ON CONFLICT (employee_email) DO NOTHING;

  -- ────────────────────────────────────────────────────────────────────────
  -- 5. Insert the 5 new ABHs.
  --
  --    _level_1 = the SBH of their state. This is mandatory, not optional: ABH
  --    flow is [1,2,3], so their claims start at stage 1, and
  --    shouldBlockForMissingLevel1Approver throws on submit if it is NULL.
  --    Role is EMPLOYEE only — they submit, they do not approve.
  --
  --    ⚠ Sparsh Gupta points at Arka, who is still formally the MH SBH until
  --    Phase 3 step 2 moves him to Rajasthan. Arka is the correct end-state RJ
  --    approver either way, and step 7 below gives him his RJ state row, so the
  --    same-state expectation in approver_selection_rules holds from here on.
  --
  --    But this transient is NOT harmless, and an earlier draft got it wrong:
  --    the Maharashtra migration used to sweep by pointer alone ("everyone whose
  --    level_1 is Arka") and therefore captured Sparsh, leaving a Rajasthan ABH
  --    reporting to the Maharashtra SBH. That migration now filters on MH
  --    primary state. If anyone ever reintroduces an unfiltered sweep keyed on
  --    approval_employee_id_level_1, this row is the one it will break.
  -- ────────────────────────────────────────────────────────────────────────
  INSERT INTO public.employees (
    employee_id, employee_name, employee_email, designation_id, employee_status_id,
    approval_employee_id_level_1, approval_employee_id_level_2, approval_employee_id_level_3
  )
  SELECT
    spec.employee_id,
    spec.employee_name,
    spec.employee_email,
    d.id,
    st.id,
    sbh.id,
    zbh.id,
    hod.id
  FROM (
    VALUES
      ('NW0007161', 'Siranjeeva C',     'siranjeeva.c@nxtwave.co.in',      'sreejish.mohanakumar@nxtwave.co.in', NULL),
      ('NW0007243', 'Rethina Kumar C',  'c.rethinakumar@nxtwave.co.in',    'sreejish.mohanakumar@nxtwave.co.in', NULL),
      ('NW0007236', 'Nilesh Tiwari',    'nilesh.tiwari@nxtwave.co.in',     'akshaykumar.pal@nxtwave.co.in',      'satyapriya.dash@nxtwave.co.in'),
      ('NW0007233', 'Prathamesh Pawar', 'prathamesh.pawar@nxtwave.co.in',  'ashish.prakashpatil@nxtwave.co.in',  'harisanthosh.tibirisetty@nxtwave.co.in'),
      ('NW0007253', 'Sparsh Gupta',     'sparsh.gupta@nxtwave.co.in',      'arkaprabha.ghosh@nxtwave.co.in',     'satyapriya.dash@nxtwave.co.in')
  ) AS spec(employee_id, employee_name, employee_email, sbh_email, zbh_email)
  JOIN public.designations d ON d.designation_code = 'ABH'
  JOIN public.employee_statuses st ON st.status_code = 'ACTIVE'
  JOIN public.employees hod ON lower(hod.employee_email) = 'mansoor@nxtwave.co.in'
  JOIN public.employees sbh ON lower(sbh.employee_email) = spec.sbh_email  -- INNER: a missing SBH must fail, not insert NULL
  LEFT JOIN public.employees zbh ON lower(zbh.employee_email) = spec.zbh_email
  ON CONFLICT (employee_email) DO NOTHING;

  -- ────────────────────────────────────────────────────────────────────────
  -- 6. Guard: all 9 must now exist. If an ABH row silently failed to insert
  --    because its SBH was missing, catch it here rather than at 09:00 on
  --    Monday when someone cannot submit a claim.
  -- ────────────────────────────────────────────────────────────────────────
  SELECT string_agg(expected.email, ', ')
  INTO v_missing
  FROM (
    VALUES
      ('ashish.prakashpatil@nxtwave.co.in'), ('bipin.sati@nxtwave.co.in'),
      ('jijo.varghese@nxtwave.co.in'), ('nithin.k@nxtwave.co.in'),
      ('siranjeeva.c@nxtwave.co.in'), ('c.rethinakumar@nxtwave.co.in'),
      ('nilesh.tiwari@nxtwave.co.in'), ('prathamesh.pawar@nxtwave.co.in'),
      ('sparsh.gupta@nxtwave.co.in')
  ) AS expected(email)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.employees e WHERE lower(e.employee_email) = expected.email
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 2 failed: new employee row(s) not created: %', v_missing;
  END IF;

  -- ────────────────────────────────────────────────────────────────────────
  -- 7. State mappings.
  --
  --    employee_states does NOT route approvals — it drives the admin approver
  --    dropdown (get_admin_approver_options_by_state), state-scoped expense
  --    rates, outstation city lists, and analytics filters. Getting it wrong
  --    does not misroute a claim; it makes the wrong names appear in admin
  --    pickers and fragments the reporting.
  --
  --    Includes the two repairs to existing rows:
  --      * Sreejish  TN → primary, KL → demoted (see step 1)
  --      * Arka      RJ → primary (he had NO state row at all)
  --    DO UPDATE on the conflict makes both repairs and the fresh inserts the
  --    same statement, and makes a re-run converge rather than error.
  --
  --    NOTE: idx_employee_states_primary is NOT a unique index, so multiple
  --    primaries per employee are physically possible. The demotion of KL is
  --    therefore an explicit row, not an implicit consequence of promoting TN.
  -- ────────────────────────────────────────────────────────────────────────
  INSERT INTO public.employee_states (employee_id, state_id, is_primary)
  SELECT e.id, s.id, spec.is_primary
  FROM (
    VALUES
      -- new SBHs
      ('ashish.prakashpatil@nxtwave.co.in', 'MH', true),
      ('bipin.sati@nxtwave.co.in',          'DL', true),
      ('jijo.varghese@nxtwave.co.in',       'KL', true),
      ('nithin.k@nxtwave.co.in',            'KA', true),
      -- new ABHs
      ('siranjeeva.c@nxtwave.co.in',        'TN', true),
      ('c.rethinakumar@nxtwave.co.in',      'TN', true),
      ('nilesh.tiwari@nxtwave.co.in',       'UP', true),
      ('prathamesh.pawar@nxtwave.co.in',    'MH', true),
      ('sparsh.gupta@nxtwave.co.in',        'RJ', true),
      -- repairs to existing rows
      ('sreejish.mohanakumar@nxtwave.co.in','TN', true),
      ('sreejish.mohanakumar@nxtwave.co.in','KL', false),
      ('arkaprabha.ghosh@nxtwave.co.in',    'RJ', true)
  ) AS spec(employee_email, state_code, is_primary)
  JOIN public.employees e ON lower(e.employee_email) = spec.employee_email
  JOIN public.states s ON s.state_code = spec.state_code
  ON CONFLICT (employee_id, state_id) DO UPDATE
    SET is_primary = EXCLUDED.is_primary;

  -- ────────────────────────────────────────────────────────────────────────
  -- 8. Roles.
  --
  --    All nine get EMPLOYEE. The four SBHs additionally get APPROVER_L1 —
  --    without it submit_approval_action_atomic rejects their approvals, because
  --    the L1_PENDING → L2_PENDING transition carries requires_role_id =
  --    APPROVER_L1 and the RPC checks the actor holds it.
  --
  --    DO UPDATE SET is_active = true rather than DO NOTHING, so a previously
  --    revoked (is_active = false) row is reinstated rather than ignored.
  -- ────────────────────────────────────────────────────────────────────────
  INSERT INTO public.employee_roles (employee_id, role_id, is_active)
  SELECT e.id, r.id, true
  FROM (
    VALUES
      ('ashish.prakashpatil@nxtwave.co.in', 'EMPLOYEE'), ('ashish.prakashpatil@nxtwave.co.in', 'APPROVER_L1'),
      ('bipin.sati@nxtwave.co.in',          'EMPLOYEE'), ('bipin.sati@nxtwave.co.in',          'APPROVER_L1'),
      ('jijo.varghese@nxtwave.co.in',       'EMPLOYEE'), ('jijo.varghese@nxtwave.co.in',       'APPROVER_L1'),
      ('nithin.k@nxtwave.co.in',            'EMPLOYEE'), ('nithin.k@nxtwave.co.in',            'APPROVER_L1'),
      ('siranjeeva.c@nxtwave.co.in',        'EMPLOYEE'),
      ('c.rethinakumar@nxtwave.co.in',      'EMPLOYEE'),
      ('nilesh.tiwari@nxtwave.co.in',       'EMPLOYEE'),
      ('prathamesh.pawar@nxtwave.co.in',    'EMPLOYEE'),
      ('sparsh.gupta@nxtwave.co.in',        'EMPLOYEE')
  ) AS spec(employee_email, role_code)
  JOIN public.employees e ON lower(e.employee_email) = spec.employee_email
  JOIN public.roles r ON r.role_code = spec.role_code
  ON CONFLICT (employee_id, role_id) DO UPDATE SET is_active = true;

  -- ────────────────────────────────────────────────────────────────────────
  -- 9. Final assertion — every new SBH holds APPROVER_L1 and every new ABH has
  --    a non-NULL _level_1. These are the two failure modes that are invisible
  --    until someone tries to use the system.
  -- ────────────────────────────────────────────────────────────────────────
  SELECT count(*) INTO v_count
  FROM public.employees e
  JOIN public.designations d ON d.id = e.designation_id
  WHERE lower(e.employee_email) IN (
      'ashish.prakashpatil@nxtwave.co.in','bipin.sati@nxtwave.co.in',
      'jijo.varghese@nxtwave.co.in','nithin.k@nxtwave.co.in',
      'sreejish.mohanakumar@nxtwave.co.in')
    AND d.designation_code = 'SBH'
    AND NOT EXISTS (
      SELECT 1 FROM public.employee_roles er
      JOIN public.roles r ON r.id = er.role_id
      WHERE er.employee_id = e.id AND r.role_code = 'APPROVER_L1' AND er.is_active
    );

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Phase 2 failed: % SBH(s) are missing an active APPROVER_L1 role.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.employees e
  WHERE lower(e.employee_email) IN (
      'siranjeeva.c@nxtwave.co.in','c.rethinakumar@nxtwave.co.in',
      'nilesh.tiwari@nxtwave.co.in','prathamesh.pawar@nxtwave.co.in',
      'sparsh.gupta@nxtwave.co.in')
    AND e.approval_employee_id_level_1 IS NULL;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Phase 2 failed: % new ABH(s) have no level-1 approver; they would be blocked from submitting.', v_count;
  END IF;

  RAISE NOTICE 'Phase 2 complete: 9 new employees created, Sreejish reactivated, Hijas ID converted, MH/RJ states backfilled.';
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- Record the hierarchy change as a config version. Claim snapshots pin the
-- latest config_versions row at insert time, so this gives every claim submitted
-- after this migration a version that names the change it was filed under.
--
-- ⚠ version_number is GENERATED ALWAYS AS IDENTITY, so an explicit value is
-- REJECTED outright (SQLSTATE 428C9), not silently ignored. Note that identity
-- columns report column_default = NULL in information_schema — checking only the
-- default is what makes an identity column look like a plain NOT NULL column.
--
-- The shape is therefore detected at runtime rather than assumed, so this works
-- unchanged whether the target database defines the column as an identity, with
-- a plain default, or as a bare NOT NULL column. Same file, dev and production.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_tag       constant text := 'Hierarchy changes 2026-07 Phase 2:';
  v_summary   constant text := v_tag || ' created 9 new employees (4 SBH, 5 ABH), '
    'reactivated Sreejish Mohana Kumar as TN SBH with APPROVER_L1, converted '
    'Muhammed Hijas to employee ID NW0007045, backfilled MH and RJ state mappings.';
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
    -- The database numbers the row itself. Supplying a value would be rejected
    -- (GENERATED ALWAYS) or would desynchronise the sequence (GENERATED BY
    -- DEFAULT), so the column is omitted entirely.
    INSERT INTO public.config_versions (change_scope, change_summary)
    VALUES ('employee_hierarchy', v_summary);
  ELSE
    -- Bare NOT NULL column with no default: compute the next value ourselves.
    INSERT INTO public.config_versions (version_number, change_scope, change_summary)
    SELECT coalesce(max(version_number), 0) + 1, 'employee_hierarchy', v_summary
    FROM public.config_versions;
  END IF;
END $$;
