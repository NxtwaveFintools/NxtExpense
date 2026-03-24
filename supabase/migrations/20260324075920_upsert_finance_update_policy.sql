-- NO-OP: This migration originally recreated the "finance can update finance review claims"
-- policy using deprecated columns (employees.designation, expense_claims.status).
-- Both columns have been dropped. The correct ID-based policy was already created
-- by migration 144_drop_legacy_artifacts.sql.
SELECT 1;
