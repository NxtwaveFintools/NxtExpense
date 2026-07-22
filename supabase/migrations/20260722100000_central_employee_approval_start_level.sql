-- Per-employee approval start-level override.
--
-- Approval routing is two independent mechanisms:
--   1. WHERE a claim starts  — designation_approval_flow.required_approval_levels[0]
--   2. every hop AFTER that  — claim_status_transitions, keyed on from_status_id only
--
-- Only element [0] of required_approval_levels has any runtime effect; the tail
-- is decorative (getNextApprovalLevel is dead code, imported by tests only).
-- This column overrides that single value for one employee, without changing
-- their designation — so all reporting, analytics, and CSV exports continue to
-- count them under their real designation. That reporting continuity is the
-- reason this approach was chosen over creating a new designation.
--
-- Values: 1 = start at SBH stage, 2 = start at HOD stage.
-- 3 is deliberately excluded: stage 3 is Finance and has no approver column, so
-- a value of 3 would route the claim PAST the HOD straight to Finance
-- (claims.repository.ts nulls current_approval_level for firstLevel >= 3).
--
-- Business case: Narina Venkata Naga Chandramouli (NW0003405) is a Business
-- Operation Associate on the central team. He has no SBH, so BOA's [1,2,3] flow
-- stranded his claims at stage 1 with no eligible approver.

-- This migration is idempotent: every statement is safe to re-run. Re-running
-- it is a no-op, not an error and not a data change.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS approval_start_level smallint NULL;

-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, so drop-then-add. At 116 rows
-- the revalidation scan is free. This also means an edited constraint
-- definition is picked up on re-run rather than silently ignored.
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_approval_start_level_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_approval_start_level_check
  CHECK (approval_start_level IS NULL OR approval_start_level IN (1, 2));

COMMENT ON COLUMN public.employees.approval_start_level IS
  'Per-employee override for the approval stage a new claim starts at. '
  'NULL = use designation_approval_flow.required_approval_levels[0]. '
  'Set to 2 for central-team staff who have no SBH and route direct to HOD. '
  'Only 1 and 2 are valid: stage 3 is Finance and has no approver column.';

-- IS DISTINCT FROM makes the re-run touch zero rows rather than rewriting the
-- row to the value it already holds. Matching no employee (e.g. a fresh local
-- database seeded without him) is a no-op, not a failure.
UPDATE public.employees
SET approval_start_level = 2
WHERE employee_id = 'NW0003405'
  AND approval_start_level IS DISTINCT FROM 2;

-- ────────────────────────────────────────────────────────────────────────
-- Stamp the override into the claim config snapshot.
--
-- The snapshot's 'approval_flow' key is read from designation_approval_flow
-- by designation. For an employee with approval_start_level set, that key
-- reports the designation's flow (e.g. [1,2,3]) while the claim actually
-- started at the overridden stage — a record that contradicts itself.
-- Recording the override alongside it makes every claim explain why it
-- started where it did.
--
-- Only the 'claim_context' object changes; the rest of the function is
-- reproduced verbatim because CREATE OR REPLACE requires the full body.
-- ────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.capture_claim_config_snapshot_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_version_id uuid;
  v_snapshot jsonb;
BEGIN
  SELECT id
  INTO v_version_id
  FROM public.config_versions
  ORDER BY version_number DESC
  LIMIT 1;

  IF v_version_id IS NULL THEN
    INSERT INTO public.config_versions (change_scope, change_summary)
    VALUES ('bootstrap', 'Auto-created baseline configuration version.')
    RETURNING id INTO v_version_id;
  END IF;

  v_snapshot := jsonb_build_object(
    'claim_context',
    jsonb_build_object(
      'claim_id', NEW.id,
      'claim_date', NEW.claim_date,
      'employee_id', NEW.employee_id,
      'designation_id', NEW.designation_id,
      'work_location_id', NEW.work_location_id,
      'base_location_day_type_code', NEW.base_location_day_type_code,
      'vehicle_type_id', NEW.vehicle_type_id,
      'outstation_state_id', NEW.outstation_state_id,
      'has_intercity_travel', NEW.has_intercity_travel,
      'has_intracity_travel', NEW.has_intracity_travel,
      'intercity_own_vehicle_used', NEW.intercity_own_vehicle_used,
      'intracity_own_vehicle_used', NEW.intracity_own_vehicle_used,
      -- ── ADDED: per-employee approval start-level override ──────────────
      'approval_start_level_override',
      (
        SELECT e.approval_start_level
        FROM public.employees e
        WHERE e.id = NEW.employee_id
      )
      -- ───────────────────────────────────────────────────────────────────
    ),
    'state_city_master',
    jsonb_build_object(
      'outstation_state',
      CASE
        WHEN NEW.outstation_state_id IS NULL THEN NULL::jsonb
        ELSE jsonb_build_object(
          'id', NEW.outstation_state_id,
          'name', NEW.outstation_state_name_snapshot
        )
      END,
      'outstation_city',
      CASE
        WHEN NEW.outstation_city_id IS NULL THEN NULL::jsonb
        ELSE jsonb_build_object(
          'id', NEW.outstation_city_id,
          'name', NEW.outstation_city_name_snapshot
        )
      END,
      'from_city',
      CASE
        WHEN NEW.from_city_id IS NULL THEN NULL::jsonb
        ELSE jsonb_build_object(
          'id', NEW.from_city_id,
          'name', NEW.from_city_name_snapshot
        )
      END,
      'to_city',
      CASE
        WHEN NEW.to_city_id IS NULL THEN NULL::jsonb
        ELSE jsonb_build_object(
          'id', NEW.to_city_id,
          'name', NEW.to_city_name_snapshot
        )
      END
    ),
    'designation',
    (
      SELECT to_jsonb(d)
      FROM public.designations d
      WHERE d.id = NEW.designation_id
    ),
    'work_location',
    (
      SELECT to_jsonb(wl)
      FROM public.work_locations wl
      WHERE wl.id = NEW.work_location_id
    ),
    'vehicle_type',
    (
      SELECT to_jsonb(vt)
      FROM public.vehicle_types vt
      WHERE vt.id = NEW.vehicle_type_id
    ),
    'approval_flow',
    (
      SELECT to_jsonb(af)
      FROM public.designation_approval_flow af
      WHERE af.designation_id = NEW.designation_id
        AND af.is_active = true
      ORDER BY af.created_at DESC
      LIMIT 1
    ),
    'allowed_vehicle_types',
    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(vt) ORDER BY vt.display_order)
        FROM public.designation_vehicle_permissions p
        JOIN public.vehicle_types vt ON vt.id = p.vehicle_type_id
        WHERE p.designation_id = NEW.designation_id
      ),
      '[]'::jsonb
    ),
    'effective_expense_rates',
    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(er) ORDER BY er.expense_type, er.effective_from DESC)
        FROM public.expense_rates er
        WHERE er.location_id = NEW.work_location_id
          AND er.is_active = true
          AND er.effective_from <= NEW.claim_date
          AND (er.effective_to IS NULL OR er.effective_to >= NEW.claim_date)
          AND (er.designation_id IS NULL OR er.designation_id = NEW.designation_id)
      ),
      '[]'::jsonb
    ),
    'validation_rules',
    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(vr) ORDER BY vr.rule_code)
        FROM public.validation_rules vr
        WHERE vr.is_active = true
      ),
      '[]'::jsonb
    ),
    'system_settings',
    COALESCE(
      (
        SELECT jsonb_object_agg(ss.setting_key, ss.setting_value)
        FROM public.system_settings ss
        WHERE ss.is_active = true
      ),
      '{}'::jsonb
    )
  );

  INSERT INTO public.claim_config_snapshots (
    claim_id,
    config_version_id,
    snapshot_data
  )
  VALUES (
    NEW.id,
    v_version_id,
    v_snapshot
  )
  ON CONFLICT (claim_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
