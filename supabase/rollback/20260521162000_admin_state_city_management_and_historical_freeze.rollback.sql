-- Rollback for: 20260521162000_admin_state_city_management_and_historical_freeze.sql
--
-- Idempotent rollback notes:
-- - Safe to run multiple times.
-- - Uses IF EXISTS and guarded blocks for prod/test compatibility.

DO $$
BEGIN
  IF to_regclass('public.expense_claims') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_expense_claims_location_snapshot ON public.expense_claims';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.populate_claim_location_name_snapshots();

DROP FUNCTION IF EXISTS public.admin_create_state_atomic(text, text);
DROP FUNCTION IF EXISTS public.admin_update_state_atomic(uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_toggle_state_active_atomic(uuid, boolean, text);
DROP FUNCTION IF EXISTS public.admin_create_city_atomic(uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_update_city_atomic(uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_toggle_city_active_atomic(uuid, boolean, text);
DROP FUNCTION IF EXISTS public.admin_bulk_import_cities_atomic(uuid, text, text);

CREATE OR REPLACE FUNCTION public.bump_config_version_from_admin_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.entity_type IN (
    'designation',
    'work_location',
    'vehicle_type',
    'vehicle_type_rates',
    'expense_rate_amount',
    'expense_rate_status',
    'approval_chain',
    'designation_vehicle_permission',
    'validation_rule',
    'system_setting',
    'approval_flow'
  ) THEN
    INSERT INTO public.config_versions (
      source_admin_log_id,
      change_scope,
      change_summary,
      created_by
    )
    VALUES (
      NEW.id,
      NEW.entity_type,
      concat('Admin action: ', NEW.action_type, ' on ', NEW.entity_type),
      NEW.admin_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

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

DO $$
BEGIN
  IF to_regclass('public.claim_config_snapshots') IS NOT NULL THEN
    UPDATE public.claim_config_snapshots ccs
    SET snapshot_data = coalesce(ccs.snapshot_data, '{}'::jsonb) - 'state_city_master'
    WHERE coalesce(ccs.snapshot_data, '{}'::jsonb) ? 'state_city_master';
  END IF;
END $$;

ALTER TABLE IF EXISTS public.expense_claims
DROP COLUMN IF EXISTS outstation_state_name_snapshot,
DROP COLUMN IF EXISTS outstation_city_name_snapshot,
DROP COLUMN IF EXISTS from_city_name_snapshot,
DROP COLUMN IF EXISTS to_city_name_snapshot;
