-- Phase 1b index. The finance resolver (finance_filtered_claim_ids) filters
-- expense_claims by submitted_at for the 'submitted_at' date field, mirroring the
-- existing claim_date filter. claim_date already has idx_expense_claims_claim_date,
-- but submitted_at had no index, so even a narrow submitted_at range full-seq-scans
-- the whole table (verified via EXPLAIN ANALYZE: a 1-week range returning 59 rows
-- scanned all ~17.5k rows). This brings submitted_at to parity with claim_date and
-- keeps narrow date filters index-driven as the table grows.
create index if not exists idx_expense_claims_submitted_at
  on public.expense_claims (submitted_at);
