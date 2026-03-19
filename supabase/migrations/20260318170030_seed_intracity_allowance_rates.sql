-- Seed DB-driven intra-city own-vehicle allowance rates for Field Outstation.

BEGIN;

-- =============================================================================
-- 1. Seed outstation intra-city allowance rates
-- =============================================================================
WITH outstation_location AS (
  SELECT id
  FROM public.work_locations
  WHERE location_code = 'FIELD_OUTSTATION'
  LIMIT 1
)
INSERT INTO public.expense_rates (
  designation_id,
  location_id,
  expense_type,
  rate_amount,
  effective_from,
  effective_to,
  is_active
)
SELECT
  NULL,
  ol.id,
  rates.expense_type,
  rates.rate_amount,
  CURRENT_DATE,
  NULL,
  true
FROM outstation_location ol
CROSS JOIN (
  VALUES
    ('INTRACITY_ALLOWANCE_TWO_WHEELER'::VARCHAR(50), 180.00::DECIMAL(10,2)),
    ('INTRACITY_ALLOWANCE_FOUR_WHEELER'::VARCHAR(50), 300.00::DECIMAL(10,2))
) AS rates(expense_type, rate_amount)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.expense_rates er
  WHERE er.location_id = ol.id
    AND er.designation_id IS NULL
    AND er.expense_type = rates.expense_type
    AND er.is_active = true
    AND er.effective_to IS NULL
);

-- =============================================================================
-- 2. Optional validation rule markers (ops visibility, app still validates)
-- =============================================================================
INSERT INTO public.validation_rules (
  rule_code,
  rule_name,
  rule_value,
  rule_description,
  is_active
)
SELECT
  seed.rule_code,
  seed.rule_name,
  seed.rule_value,
  seed.rule_description,
  true
FROM (
  VALUES
    (
      'OUTSTATION_ALLOW_NO_OWN_VEHICLE_SUBMISSION',
      'Field Outstation allows no-own-vehicle submission',
      '{"value": true}'::jsonb,
      'If both inter-city and intra-city own vehicle selections are No, submission is still allowed with food allowance only.'
    ),
    (
      'INTERCITY_DISTINCT_FROM_TO_CITY',
      'Inter-city requires distinct route cities',
      '{"value": true}'::jsonb,
      'From and To city cannot be same when inter-city travel is selected.'
    ),
    (
      'NON_OWN_VEHICLE_TRAVEL_REIMBURSEMENT_DISABLED',
      'Non-own-vehicle travel reimbursement disabled in app flow',
      '{"value": true}'::jsonb,
      'When own vehicle is not used, transport reimbursement amount is not captured in this workflow.'
    )
) AS seed(rule_code, rule_name, rule_value, rule_description)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.validation_rules vr
  WHERE vr.rule_code = seed.rule_code
);

COMMIT;
