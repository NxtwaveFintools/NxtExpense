-- Rollback for: 20260722100000_central_employee_approval_start_level.sql
--
-- Restores employees and the claim config snapshot trigger to their
-- pre-migration state: no approval_start_level column, no CHECK constraint,
-- and the snapshot's claim_context without the approval_start_level_override
-- key.
--
-- NOTE: rolling back re-breaks Narina Venkata Naga Chandramouli (NW0003405).
-- He is a Business Operation Associate with no Level 1 (SBH) approver, and
-- BOA's designation flow starts at stage 1. Without the override his claims
-- land at L1_PENDING with no eligible approver and cannot be actioned by
-- anyone — the exact silent stranding the forward migration fixed. The
-- Task 4 submit guard (application code) will instead reject his submissions
-- outright with a configuration error, which is louder but still blocking.
-- Prefer fixing forward.
--
-- ⚠️ ORDER OF OPERATIONS: revert the application code BEFORE running this.
-- EMPLOYEE_COLUMNS in src/lib/services/employee-service.ts is an explicit
-- PostgREST select list naming approval_start_level. If this script drops the
-- column while that code is still deployed, every employee fetch fails with
-- "column does not exist" — taking down login, claims, and approvals. Code
-- first, then this script.
--
-- This script is idempotent: safe to re-run, no-op the second time.


-- ── 1. Trigger function: remove the override key from claim_context ─────────
--
-- MUST run before the column is dropped. plpgsql bodies are not validated at
-- drop time, so dropping the column first would not error here — it would
-- leave the trigger referencing a missing column and fail at runtime on the
-- next claim insert, blocking all submissions.
--
-- Body below is the verbatim pre-migration definition.

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
      'intracity_own_vehicle_used', NEW.intracity_own_vehicle_used
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


-- ── 2. Drop the CHECK constraint ───────────────────────────────────────────

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_approval_start_level_check;


-- ── 3. Drop the column ─────────────────────────────────────────────────────
--
-- This destroys the override data (NW0003405 = 2). Re-applying the forward
-- migration restores it, since the UPDATE is part of that file.

ALTER TABLE public.employees
  DROP COLUMN IF EXISTS approval_start_level;


-- ── Not rolled back: historical snapshots ──────────────────────────────────
--
-- Claims submitted while the forward migration was live carry
-- claim_context.approval_start_level_override in claim_config_snapshots.
-- Those rows are deliberately left untouched: they are the audit record of
-- how those claims were actually routed, and rewriting them would falsify it.
-- Readers of that key must tolerate its absence on older and newer rows —
-- which they already must, since it is null for every employee without an
-- override.
