-- ============================================================
-- Migration 122: Populate new UUID columns from old text/enum values
-- HIGH RISK - modifying existing data
-- ============================================================

BEGIN;

-- 1. expense_claims: work_location_id
UPDATE expense_claims ec
SET work_location_id = wl.id
FROM work_locations wl
WHERE (ec.work_location::text = 'Office / WFH' AND wl.location_code = 'OFFICE_WFH')
   OR (ec.work_location::text = 'Field - Base Location' AND wl.location_code = 'FIELD_BASE')
   OR (ec.work_location::text = 'Field - Outstation' AND wl.location_code = 'FIELD_OUTSTATION')
   OR (ec.work_location::text = 'Leave' AND wl.location_code = 'LEAVE')
   OR (ec.work_location::text = 'Week-off' AND wl.location_code = 'WEEK_OFF');

-- 2. expense_claims: vehicle_type_id
UPDATE expense_claims ec
SET vehicle_type_id = vt.id
FROM vehicle_types vt
WHERE ec.vehicle_type IS NOT NULL
  AND (
    (ec.vehicle_type::text = 'Two Wheeler' AND vt.vehicle_code = 'TWO_WHEELER')
    OR (ec.vehicle_type::text = 'Four Wheeler' AND vt.vehicle_code = 'FOUR_WHEELER')
  );

-- 3. expense_claims: designation_id (from employee's designation)
UPDATE expense_claims ec
SET designation_id = emp.designation_id
FROM employees emp
WHERE ec.employee_id = emp.id;

-- 4. expense_claims: status_id
UPDATE expense_claims ec
SET status_id = CASE
  WHEN ec.status::text = 'draft' THEN get_claim_status_id('DRAFT')
  WHEN ec.status::text = 'submitted' THEN get_claim_status_id('SUBMITTED')
  WHEN ec.status::text = 'pending_approval' AND ec.current_approval_level = 1 THEN get_claim_status_id('L1_PENDING')
  WHEN ec.status::text = 'pending_approval' AND ec.current_approval_level >= 2 THEN get_claim_status_id('L2_PENDING')
  WHEN ec.status::text = 'approved' THEN get_claim_status_id('L2_APPROVED')
  WHEN ec.status::text = 'rejected' AND COALESCE(ec.current_approval_level, 1) = 1 THEN get_claim_status_id('L1_REJECTED')
  WHEN ec.status::text = 'rejected' AND ec.current_approval_level >= 2 THEN get_claim_status_id('L2_REJECTED')
  WHEN ec.status::text = 'finance_review' THEN get_claim_status_id('L3_PENDING_FINANCE_REVIEW')
  WHEN ec.status::text = 'issued' THEN get_claim_status_id('L4_ISSUED')
  WHEN ec.status::text = 'finance_rejected' THEN get_claim_status_id('L3_REJECTED_FINANCE')
  WHEN ec.status::text = 'returned_for_modification' THEN get_claim_status_id('RETURNED_FOR_MODIFICATION')
END;

-- 5. expense_claims: city columns
UPDATE expense_claims ec
SET outstation_city_id = c.id
FROM cities c
WHERE ec.outstation_location IS NOT NULL
  AND LOWER(TRIM(ec.outstation_location)) = LOWER(TRIM(c.city_name));

UPDATE expense_claims ec
SET from_city_id = c.id
FROM cities c
WHERE ec.from_city IS NOT NULL
  AND LOWER(TRIM(ec.from_city)) = LOWER(TRIM(c.city_name));

UPDATE expense_claims ec
SET to_city_id = c.id
FROM cities c
WHERE ec.to_city IS NOT NULL
  AND LOWER(TRIM(ec.to_city)) = LOWER(TRIM(c.city_name));

-- 6. approval_history: approver_employee_id
UPDATE approval_history ah
SET approver_employee_id = emp.id
FROM employees emp
WHERE ah.approver_email = emp.employee_email
  AND ah.approver_email != 'system@nxt-expense.internal';

-- 7. approval_history: old_status_id and new_status_id
UPDATE approval_history ah
SET
  old_status_id = CASE
    WHEN ah.action::text = 'approved' AND ah.approval_level = 1 THEN get_claim_status_id('L1_PENDING')
    WHEN ah.action::text = 'approved' AND ah.approval_level IN (2,3) THEN get_claim_status_id('L2_PENDING')
    WHEN ah.action::text = 'rejected' AND ah.approval_level = 1 THEN get_claim_status_id('L1_PENDING')
    WHEN ah.action::text = 'rejected' AND ah.approval_level IN (2,3) THEN get_claim_status_id('L2_PENDING')
    WHEN ah.action::text = 'finance_issued' THEN get_claim_status_id('L3_PENDING_FINANCE_REVIEW')
    WHEN ah.action::text = 'finance_rejected' THEN get_claim_status_id('L3_PENDING_FINANCE_REVIEW')
    WHEN ah.action::text = 'resubmitted' THEN get_claim_status_id('RETURNED_FOR_MODIFICATION')
    WHEN ah.action::text = 'reopened' THEN get_claim_status_id('L3_REJECTED_FINANCE')
    WHEN ah.action::text = 'bypass_logged' AND ah.approval_level = 2 THEN get_claim_status_id('L1_APPROVED')
    WHEN ah.action::text = 'admin_override' THEN get_claim_status_id('L1_PENDING')
    ELSE NULL
  END,
  new_status_id = CASE
    WHEN ah.action::text = 'approved' AND ah.approval_level = 1 THEN get_claim_status_id('L1_APPROVED')
    WHEN ah.action::text = 'approved' AND ah.approval_level IN (2,3) THEN get_claim_status_id('L2_APPROVED')
    WHEN ah.action::text = 'rejected' AND ah.approval_level = 1 THEN get_claim_status_id('L1_REJECTED')
    WHEN ah.action::text = 'rejected' AND ah.approval_level IN (2,3) THEN get_claim_status_id('L2_REJECTED')
    WHEN ah.action::text = 'finance_issued' THEN get_claim_status_id('L4_ISSUED')
    WHEN ah.action::text = 'finance_rejected' THEN get_claim_status_id('L3_REJECTED_FINANCE')
    WHEN ah.action::text = 'resubmitted' THEN get_claim_status_id('SUBMITTED')
    WHEN ah.action::text = 'reopened' THEN get_claim_status_id('RETURNED_FOR_MODIFICATION')
    WHEN ah.action::text = 'bypass_logged' AND ah.approval_level = 2 THEN get_claim_status_id('L2_APPROVED')
    WHEN ah.action::text = 'admin_override' THEN get_claim_status_id('L1_APPROVED')
    ELSE NULL
  END;

-- 8. finance_actions: actor_employee_id
UPDATE finance_actions fa
SET actor_employee_id = emp.id
FROM employees emp
WHERE fa.actor_email = emp.employee_email;

COMMIT;
