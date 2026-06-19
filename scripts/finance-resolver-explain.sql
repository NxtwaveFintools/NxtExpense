-- Resolver plan probes. Run against the dev project and inspect for seq scans.

-- 1) The wide payment_released case (the shape that overflowed the URL pre-fix).
explain (analyze, buffers)
select id from public.finance_filtered_claim_ids(
  p_date_field => 'payment_released_date',
  p_date_from  => '2025-09-01T00:00:00+05:30',
  p_date_to    => '2026-05-31T23:59:59.999+05:30'
);

-- 2) No-filter default (allow_resubmit exclusion only).
explain (analyze, buffers)
select id from public.finance_filtered_claim_ids();

-- 3) HOD approver present.
explain (analyze, buffers)
select id from public.finance_filtered_claim_ids(
  p_hod_approver_emp => (select approver_employee_id from approval_history limit 1)
);
