-- Shorten summer food allowance end date from 30 Jun to 14 Jun 2026.
--
-- Business intent (confirmed):
--   * Summer rates (FOOD_BASE & FOOD_OUTSTATION, all states/designations) should
--     expire on 14 Jun 2026 instead of 30 Jun 2026.
--   * Normal rates (FOOD_BASE Rs.120, FOOD_OUTSTATION Rs.350) should kick in on
--     15 Jun 2026 instead of 01 Jul 2026.
--
-- Notes:
--   * Go-forward only. Already-submitted claims are snapshotted and unaffected.
--   * Fully idempotent: each UPDATE is guarded on exact current values, so
--     re-running on test then prod is a no-op the second time.

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. Cap all summer FOOD_BASE rows: effective_to 30 Jun → 14 Jun
-- ────────────────────────────────────────────────────────────
UPDATE public.expense_rates
SET effective_to = DATE '2026-06-14',
    updated_at   = now()
WHERE expense_type   = 'FOOD_BASE'
  AND effective_to   = DATE '2026-06-30'
  AND is_active      = true;

-- ────────────────────────────────────────────────────────────
-- 2. Cap all summer FOOD_OUTSTATION rows: effective_to 30 Jun → 14 Jun
-- ────────────────────────────────────────────────────────────
UPDATE public.expense_rates
SET effective_to = DATE '2026-06-14',
    updated_at   = now()
WHERE expense_type   = 'FOOD_OUTSTATION'
  AND effective_to   = DATE '2026-06-30'
  AND is_active      = true;

-- ────────────────────────────────────────────────────────────
-- 3. Move normal FOOD_BASE (Rs.120) start: 01 Jul → 15 Jun
-- ────────────────────────────────────────────────────────────
UPDATE public.expense_rates
SET effective_from = DATE '2026-06-15',
    updated_at     = now()
WHERE expense_type   = 'FOOD_BASE'
  AND rate_amount    = 120
  AND effective_from = DATE '2026-07-01'
  AND effective_to   IS NULL
  AND is_active      = true;

-- ────────────────────────────────────────────────────────────
-- 4. Move normal FOOD_OUTSTATION (Rs.350) start: 01 Jul → 15 Jun
-- ────────────────────────────────────────────────────────────
UPDATE public.expense_rates
SET effective_from = DATE '2026-06-15',
    updated_at     = now()
WHERE expense_type   = 'FOOD_OUTSTATION'
  AND rate_amount    = 350
  AND effective_from = DATE '2026-07-01'
  AND effective_to   IS NULL
  AND is_active      = true;

COMMIT;

-- ────────────────────────────────────────────────────────────
-- Verification (run separately after COMMIT):
--
-- SELECT er.expense_type,
--        wl.location_code,
--        COALESCE(s.state_name, 'ALL STATES') AS scope,
--        er.rate_amount, er.effective_from, er.effective_to, er.is_active
-- FROM public.expense_rates er
-- LEFT JOIN public.states s  ON s.id  = er.state_id
-- LEFT JOIN public.work_locations wl ON wl.id = er.location_id
-- WHERE er.expense_type IN ('FOOD_BASE', 'FOOD_OUTSTATION')
-- ORDER BY er.expense_type, scope, er.effective_from;
-- ────────────────────────────────────────────────────────────
