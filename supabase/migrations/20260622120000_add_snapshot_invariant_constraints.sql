-- Encode the trigger invariant (trg_expense_claims_location_snapshot) as hard
-- schema constraints. If the trigger is ever dropped or bypassed, any attempt
-- to set a location FK without populating its snapshot will be rejected at the
-- DB level rather than silently producing a null display name.
--
-- NOT VALID + VALIDATE CONSTRAINT is the production-safe pattern:
--   ADD CONSTRAINT NOT VALID — brief metadata lock, no table scan.
--   VALIDATE CONSTRAINT     — ShareUpdateExclusiveLock (non-blocking), scans rows.
ALTER TABLE public.expense_claims
  ADD CONSTRAINT expense_claims_state_snapshot_consistent
    CHECK (outstation_state_id IS NULL OR outstation_state_name_snapshot IS NOT NULL)
    NOT VALID,
  ADD CONSTRAINT expense_claims_outstation_city_snapshot_consistent
    CHECK (outstation_city_id IS NULL OR outstation_city_name_snapshot IS NOT NULL)
    NOT VALID,
  ADD CONSTRAINT expense_claims_from_city_snapshot_consistent
    CHECK (from_city_id IS NULL OR from_city_name_snapshot IS NOT NULL)
    NOT VALID,
  ADD CONSTRAINT expense_claims_to_city_snapshot_consistent
    CHECK (to_city_id IS NULL OR to_city_name_snapshot IS NOT NULL)
    NOT VALID;

ALTER TABLE public.expense_claims
  VALIDATE CONSTRAINT expense_claims_state_snapshot_consistent;
ALTER TABLE public.expense_claims
  VALIDATE CONSTRAINT expense_claims_outstation_city_snapshot_consistent;
ALTER TABLE public.expense_claims
  VALIDATE CONSTRAINT expense_claims_from_city_snapshot_consistent;
ALTER TABLE public.expense_claims
  VALIDATE CONSTRAINT expense_claims_to_city_snapshot_consistent;
