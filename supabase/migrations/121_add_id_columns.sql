BEGIN;

-- Migration 121: Add ID-based FK columns to expense_claims, approval_history, finance_actions
-- Also adds missing cities referenced in existing data
-- Columns are NULLABLE initially — will be populated in migration 122

-- Add missing cities that exist in claim data but not in cities table
INSERT INTO cities (city_name, state_id)
SELECT 'Eravalli', s.id FROM states s WHERE s.state_code = 'TG'
  AND NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Eravalli');

INSERT INTO cities (city_name, state_id)
SELECT 'Gadwal', s.id FROM states s WHERE s.state_code = 'TG'
  AND NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Gadwal');

-- Add new ID-based columns to expense_claims
ALTER TABLE expense_claims ADD COLUMN IF NOT EXISTS designation_id UUID REFERENCES designations(id);
ALTER TABLE expense_claims ADD COLUMN IF NOT EXISTS work_location_id UUID REFERENCES work_locations(id);
ALTER TABLE expense_claims ADD COLUMN IF NOT EXISTS vehicle_type_id UUID REFERENCES vehicle_types(id);
ALTER TABLE expense_claims ADD COLUMN IF NOT EXISTS status_id UUID REFERENCES claim_statuses(id);
ALTER TABLE expense_claims ADD COLUMN IF NOT EXISTS outstation_city_id UUID REFERENCES cities(id);
ALTER TABLE expense_claims ADD COLUMN IF NOT EXISTS from_city_id UUID REFERENCES cities(id);
ALTER TABLE expense_claims ADD COLUMN IF NOT EXISTS to_city_id UUID REFERENCES cities(id);

-- Indexes on new FK columns
CREATE INDEX IF NOT EXISTS idx_ec_designation_id ON expense_claims(designation_id);
CREATE INDEX IF NOT EXISTS idx_ec_work_location_id ON expense_claims(work_location_id);
CREATE INDEX IF NOT EXISTS idx_ec_vehicle_type_id ON expense_claims(vehicle_type_id);
CREATE INDEX IF NOT EXISTS idx_ec_status_id ON expense_claims(status_id);
CREATE INDEX IF NOT EXISTS idx_ec_outstation_city ON expense_claims(outstation_city_id);

-- Add new ID column to approval_history (approver_employee_id alongside approver_email)
ALTER TABLE approval_history ADD COLUMN IF NOT EXISTS approver_employee_id UUID REFERENCES employees(id);
ALTER TABLE approval_history ADD COLUMN IF NOT EXISTS old_status_id UUID REFERENCES claim_statuses(id);
ALTER TABLE approval_history ADD COLUMN IF NOT EXISTS new_status_id UUID REFERENCES claim_statuses(id);

CREATE INDEX IF NOT EXISTS idx_ah_approver_employee ON approval_history(approver_employee_id);

-- Add new ID column to finance_actions (actor_employee_id alongside actor_email)
ALTER TABLE finance_actions ADD COLUMN IF NOT EXISTS actor_employee_id UUID REFERENCES employees(id);

CREATE INDEX IF NOT EXISTS idx_fa_actor_employee ON finance_actions(actor_employee_id);

COMMIT;
