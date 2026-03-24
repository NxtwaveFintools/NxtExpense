-- Add accommodation_nights column to expense_claims
ALTER TABLE expense_claims
  ADD COLUMN accommodation_nights integer DEFAULT NULL;

-- Add food_with_principals_amount column to expense_claims
ALTER TABLE expense_claims
  ADD COLUMN food_with_principals_amount numeric DEFAULT NULL;

-- Seed FOOD_WITH_PRINCIPALS expense rates (per designation, linked to outstation location)
DO $$
DECLARE
  v_outstation_id uuid;
  v_abh_id uuid;
  v_sbh_id uuid;
  v_zbh_id uuid;
  v_pm_id uuid;
BEGIN
  SELECT id INTO v_outstation_id FROM work_locations WHERE location_code = 'FIELD_OUTSTATION';
  SELECT id INTO v_abh_id FROM designations WHERE designation_code = 'ABH';
  SELECT id INTO v_sbh_id FROM designations WHERE designation_code = 'SBH';
  SELECT id INTO v_zbh_id FROM designations WHERE designation_code = 'ZBH';
  SELECT id INTO v_pm_id FROM designations WHERE designation_code = 'PM';

  INSERT INTO expense_rates (designation_id, location_id, expense_type, rate_amount, effective_from, is_active)
  VALUES
    (v_abh_id, v_outstation_id, 'FOOD_WITH_PRINCIPALS', 500.00, '2024-01-01', true),
    (v_sbh_id, v_outstation_id, 'FOOD_WITH_PRINCIPALS', 500.00, '2024-01-01', true),
    (v_zbh_id, v_outstation_id, 'FOOD_WITH_PRINCIPALS', 500.00, '2024-01-01', true),
    (v_pm_id, v_outstation_id, 'FOOD_WITH_PRINCIPALS', 500.00, '2024-01-01', true)
  ON CONFLICT DO NOTHING;
END $$;

-- Add a validation rule for food_with_principals monthly limit
INSERT INTO validation_rules (rule_code, rule_name, rule_value, rule_description, is_active)
VALUES ('FOOD_WITH_PRINCIPALS_MAX_PER_MONTH', 'Food With Principals Monthly Limit', '5', 'Maximum times food with principals can be claimed per calendar month', true)
ON CONFLICT DO NOTHING;
