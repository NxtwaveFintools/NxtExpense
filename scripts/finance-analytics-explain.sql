-- Phase 2b — analytics RPC plan probes. Run against the dev project; inspect for
-- pathological plans. Timings here are INFORMATIONAL ONLY — the hard gate is the
-- analytics parity test (finance-analytics-parity.test.ts).

-- History metrics, wide payment_released window (the heavy case).
explain (analyze, buffers)
select * from public.get_finance_history_metrics(
  p_date_field => 'payment_released_date',
  p_date_from  => '2025-09-01T00:00:00+05:30',
  p_date_to    => '2026-05-31T23:59:59.999+05:30'
);

-- History metrics, rejected_allow_reclaim (resolver allow_resubmit scope + rejected bucket).
explain (analyze, buffers)
select * from public.get_finance_history_metrics(
  p_action_filter => 'rejected_allow_reclaim'
);

-- Queue metrics, Path B (filters active).
explain (analyze, buffers)
select * from public.get_finance_queue_metrics(
  p_has_filters => true,
  p_date_field  => 'claim_date'
);

-- Queue metrics, Path B + action-filter intersection (EXISTS on finance_actions).
explain (analyze, buffers)
select * from public.get_finance_queue_metrics(
  p_has_filters      => true,
  p_date_field       => 'claim_date',
  p_action_intersect => 'finance_rejected'
);

-- Queue metrics, Path A (no filters -> summary table fast path).
explain (analyze, buffers)
select * from public.get_finance_queue_metrics(p_has_filters => false);
