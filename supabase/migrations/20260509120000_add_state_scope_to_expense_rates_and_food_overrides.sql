-- Adds optional state scoping to expense rates and seeds active
-- +Rs. 50 food overrides for Andhra Pradesh and Telangana.
--
-- IMPORTANT:
-- - This file is for local review and versioning.
-- - Do not execute until explicitly approved.

ALTER TABLE public.expense_rates
ADD COLUMN IF NOT EXISTS state_id uuid;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM information_schema.table_constraints
		WHERE constraint_schema = 'public'
			AND table_name = 'expense_rates'
			AND constraint_name = 'expense_rates_state_id_fkey'
	) THEN
		ALTER TABLE public.expense_rates
		ADD CONSTRAINT expense_rates_state_id_fkey
		FOREIGN KEY (state_id)
		REFERENCES public.states(id)
		ON DELETE SET NULL;
	END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_er_rate_resolution
ON public.expense_rates (
	is_active,
	location_id,
	expense_type,
	state_id,
	designation_id,
	effective_from,
	effective_to
);

WITH target_states AS (
	SELECT id, state_name
	FROM public.states
	WHERE state_name IN ('Andhra Pradesh', 'Telangana')
),
target_locations AS (
	SELECT id, location_code
	FROM public.work_locations
	WHERE location_code IN ('FIELD_BASE', 'FIELD_OUTSTATION')
),
target_expense_types AS (
	SELECT
		tl.id AS location_id,
		CASE
			WHEN tl.location_code = 'FIELD_BASE' THEN 'FOOD_BASE'
			WHEN tl.location_code = 'FIELD_OUTSTATION' THEN 'FOOD_OUTSTATION'
			ELSE NULL
		END AS expense_type
	FROM target_locations tl
),
active_global_rates AS (
	SELECT
		er.location_id,
		er.expense_type,
		er.designation_id,
		er.rate_amount,
		er.is_active,
		ROW_NUMBER() OVER (
			PARTITION BY er.location_id, er.expense_type, er.designation_id
			ORDER BY er.effective_from DESC, er.created_at DESC
		) AS rn
	FROM public.expense_rates er
	JOIN target_expense_types tet
		ON tet.location_id = er.location_id
	 AND tet.expense_type = er.expense_type
	WHERE er.is_active = true
		AND er.state_id IS NULL
		AND er.designation_id IS NULL
		AND CURRENT_DATE BETWEEN er.effective_from AND COALESCE(er.effective_to, DATE '9999-12-31')
),
candidate_overrides AS (
	SELECT
		ts.id AS state_id,
		agr.location_id,
		agr.expense_type,
		agr.designation_id,
		(agr.rate_amount + 50)::numeric(10, 2) AS rate_amount
	FROM active_global_rates agr
	CROSS JOIN target_states ts
	WHERE agr.rn = 1
),
filtered_candidates AS (
	SELECT co.*
	FROM candidate_overrides co
	WHERE NOT EXISTS (
		SELECT 1
		FROM public.expense_rates er
		WHERE er.state_id = co.state_id
			AND er.location_id = co.location_id
			AND er.expense_type = co.expense_type
			AND er.designation_id IS NOT DISTINCT FROM co.designation_id
			AND er.effective_from = CURRENT_DATE
			AND er.effective_to IS NULL
			AND er.is_active = true
	)
)
INSERT INTO public.expense_rates (
	state_id,
	location_id,
	expense_type,
	designation_id,
	rate_amount,
	effective_from,
	effective_to,
	is_active,
	created_at,
	updated_at
)
SELECT
	fc.state_id,
	fc.location_id,
	fc.expense_type,
	fc.designation_id,
	fc.rate_amount,
	CURRENT_DATE,
	NULL,
	true,
	TIMESTAMPTZ '2026-05-09 12:00:00+00',
	TIMESTAMPTZ '2026-05-09 12:00:00+00'
FROM filtered_candidates fc;
