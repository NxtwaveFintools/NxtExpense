-- ============================================================
-- Migration 123: Enforce NOT NULL constraints on mandatory ID columns
-- Only columns that should ALWAYS have a value get NOT NULL
-- ============================================================

-- expense_claims: mandatory ID columns
ALTER TABLE expense_claims ALTER COLUMN status_id SET NOT NULL;
ALTER TABLE expense_claims ALTER COLUMN work_location_id SET NOT NULL;
ALTER TABLE expense_claims ALTER COLUMN designation_id SET NOT NULL;
-- vehicle_type_id stays nullable (only field claims have vehicles)
-- outstation_city_id stays nullable (only outstation claims)
-- from_city_id stays nullable (only outstation claims)
-- to_city_id stays nullable (only outstation claims)

-- approval_history: status transitions are always tracked
ALTER TABLE approval_history ALTER COLUMN old_status_id SET NOT NULL;
ALTER TABLE approval_history ALTER COLUMN new_status_id SET NOT NULL;
-- approver_employee_id stays nullable (system actions have no employee)

-- finance_actions: actor is always a real employee
ALTER TABLE finance_actions ALTER COLUMN actor_employee_id SET NOT NULL;
