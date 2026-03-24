BEGIN;

CREATE TABLE IF NOT EXISTS public.config_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  source_admin_log_id uuid REFERENCES public.admin_logs(id) ON DELETE SET NULL,
  change_scope text NOT NULL,
  change_summary text,
  created_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_config_versions_created_at
  ON public.config_versions (created_at DESC);

INSERT INTO public.config_versions (change_scope, change_summary)
SELECT
  'bootstrap',
  'Initial baseline configuration version.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.config_versions
);

CREATE OR REPLACE FUNCTION public.bump_config_version_from_admin_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_admin_logs_bump_config_version
  ON public.admin_logs;
CREATE TRIGGER trg_admin_logs_bump_config_version
AFTER INSERT ON public.admin_logs
FOR EACH ROW
EXECUTE FUNCTION public.bump_config_version_from_admin_log();

CREATE TABLE IF NOT EXISTS public.claim_config_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL UNIQUE REFERENCES public.expense_claims(id) ON DELETE CASCADE,
  config_version_id uuid NOT NULL REFERENCES public.config_versions(id),
  snapshot_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_config_snapshots_config_version
  ON public.claim_config_snapshots (config_version_id);

ALTER TABLE public.claim_config_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS claim_config_snapshots_read_via_claim_access
  ON public.claim_config_snapshots;
CREATE POLICY claim_config_snapshots_read_via_claim_access
  ON public.claim_config_snapshots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.expense_claims c
      WHERE c.id = claim_id
    )
  );

GRANT SELECT ON public.config_versions TO authenticated;
GRANT SELECT ON public.claim_config_snapshots TO authenticated;

CREATE OR REPLACE FUNCTION public.capture_claim_config_snapshot_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_expense_claims_capture_config_snapshot
  ON public.expense_claims;
CREATE TRIGGER trg_expense_claims_capture_config_snapshot
AFTER INSERT ON public.expense_claims
FOR EACH ROW
EXECUTE FUNCTION public.capture_claim_config_snapshot_on_insert();

COMMIT;
