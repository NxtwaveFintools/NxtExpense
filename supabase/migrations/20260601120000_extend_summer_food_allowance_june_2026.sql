-- Extend the summer food allowance through 30 June 2026.
--
-- Business intent (confirmed):
--   * June 2026 (01 Jun - 30 Jun):
--       - All States  : FOOD_BASE Rs.170, FOOD_OUTSTATION Rs.400  (summer)
--       - AP & TG      : FOOD_BASE Rs.220, FOOD_OUTSTATION Rs.450  (state overrides, unchanged)
--   * From 01 July 2026 onward: everything reverts to normal
--       - All States  : FOOD_BASE Rs.120, FOOD_OUTSTATION Rs.350
--       - AP & TG      : overrides expire and fall back to the All-States normal rates
--
-- Notes:
--   * Go-forward only. Claim amounts are snapshotted at submission, so this does NOT
--     touch any already-submitted claim. Only claims calculated after this runs are affected.
--   * Fully idempotent: every statement is guarded on exact values, so re-running it
--     (e.g. on test then prod) is a no-op the second time.
--   * Run manually. Safe to run on test and prod (identical data).

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. All-States FOOD_BASE: summer Rs.170 for June, normal Rs.120 from 01 Jul
-- ────────────────────────────────────────────────────────────

-- 1a. Push the current open-ended Rs.120 row to start on 01 Jul (so June is free for the summer row).
UPDATE public.expense_rates er
SET effective_from = DATE '2026-07-01',
    updated_at = now()
FROM public.work_locations wl
WHERE wl.id = er.location_id
  AND wl.location_code = 'FIELD_BASE'
  AND er.expense_type = 'FOOD_BASE'
  AND er.state_id IS NULL
  AND er.designation_id IS NULL
  AND er.rate_amount = 120
  AND er.effective_from = DATE '2026-06-01'
  AND er.effective_to IS NULL
  AND er.is_active = true;

-- 1b. Insert the Rs.170 summer row for June (guarded against duplicates).
INSERT INTO public.expense_rates (
    location_id, expense_type, state_id, designation_id,
    rate_amount, effective_from, effective_to, is_active, created_at, updated_at
)
SELECT wl.id, 'FOOD_BASE', NULL, NULL,
       170, DATE '2026-06-01', DATE '2026-06-30', true, now(), now()
FROM public.work_locations wl
WHERE wl.location_code = 'FIELD_BASE'
  AND NOT EXISTS (
    SELECT 1 FROM public.expense_rates er
    WHERE er.location_id = wl.id
      AND er.expense_type = 'FOOD_BASE'
      AND er.state_id IS NULL
      AND er.designation_id IS NULL
      AND er.rate_amount = 170
      AND er.effective_from = DATE '2026-06-01'
      AND er.effective_to = DATE '2026-06-30'
  );

-- ────────────────────────────────────────────────────────────
-- 2. All-States FOOD_OUTSTATION: summer Rs.400 for June, normal Rs.350 from 01 Jul
-- ────────────────────────────────────────────────────────────

-- 2a. Push the current open-ended Rs.350 row to start on 01 Jul.
UPDATE public.expense_rates er
SET effective_from = DATE '2026-07-01',
    updated_at = now()
FROM public.work_locations wl
WHERE wl.id = er.location_id
  AND wl.location_code = 'FIELD_OUTSTATION'
  AND er.expense_type = 'FOOD_OUTSTATION'
  AND er.state_id IS NULL
  AND er.designation_id IS NULL
  AND er.rate_amount = 350
  AND er.effective_from = DATE '2026-06-01'
  AND er.effective_to IS NULL
  AND er.is_active = true;

-- 2b. Insert the Rs.400 summer row for June (guarded against duplicates).
INSERT INTO public.expense_rates (
    location_id, expense_type, state_id, designation_id,
    rate_amount, effective_from, effective_to, is_active, created_at, updated_at
)
SELECT wl.id, 'FOOD_OUTSTATION', NULL, NULL,
       400, DATE '2026-06-01', DATE '2026-06-30', true, now(), now()
FROM public.work_locations wl
WHERE wl.location_code = 'FIELD_OUTSTATION'
  AND NOT EXISTS (
    SELECT 1 FROM public.expense_rates er
    WHERE er.location_id = wl.id
      AND er.expense_type = 'FOOD_OUTSTATION'
      AND er.state_id IS NULL
      AND er.designation_id IS NULL
      AND er.rate_amount = 400
      AND er.effective_from = DATE '2026-06-01'
      AND er.effective_to = DATE '2026-06-30'
  );

-- ────────────────────────────────────────────────────────────
-- 3. Cap the AP & TG state overrides at 30 June 2026.
--    (They are currently open-ended; capping makes them expire after June so AP/TG
--     fall back to the All-States normal Rs.120 / Rs.350 from 01 July.)
-- ────────────────────────────────────────────────────────────
UPDATE public.expense_rates er
SET effective_to = DATE '2026-06-30',
    updated_at = now()
FROM public.states s, public.work_locations wl
WHERE s.id = er.state_id
  AND wl.id = er.location_id
  AND s.state_name IN ('Andhra Pradesh', 'Telangana')
  AND er.designation_id IS NULL
  AND er.effective_to IS NULL
  AND er.is_active = true
  AND (
        (wl.location_code = 'FIELD_BASE'       AND er.expense_type = 'FOOD_BASE')
     OR (wl.location_code = 'FIELD_OUTSTATION' AND er.expense_type = 'FOOD_OUTSTATION')
  );

COMMIT;

-- ────────────────────────────────────────────────────────────
-- Verification (run separately after COMMIT to eyeball the result):
--
-- SELECT er.expense_type,
--        wl.location_code,
--        COALESCE(s.state_name, 'ALL STATES') AS scope,
--        er.rate_amount, er.effective_from, er.effective_to, er.is_active
-- FROM public.expense_rates er
-- LEFT JOIN public.states s ON s.id = er.state_id
-- LEFT JOIN public.work_locations wl ON wl.id = er.location_id
-- WHERE er.expense_type IN ('FOOD_BASE', 'FOOD_OUTSTATION')
-- ORDER BY er.expense_type, scope, er.effective_from;
-- ────────────────────────────────────────────────────────────
