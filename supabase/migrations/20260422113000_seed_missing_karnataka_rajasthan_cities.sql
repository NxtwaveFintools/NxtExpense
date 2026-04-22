-- Migration: Seed missing Karnataka cities and Rajasthan Jhalawar.
-- Scope: Add only requested missing cities. Do not modify legacy/alternate city rows.

BEGIN;

CREATE TEMP TABLE tmp_city_seed_missing (
  state_name TEXT NOT NULL,
  city_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_city_seed_missing (state_name, city_name, sort_order)
VALUES
  ('Karnataka', 'Bagalkote', 1),
  ('Karnataka', 'Bengaluru Urban', 4),
  ('Karnataka', 'Bengaluru Rural', 5),
  ('Karnataka', 'Chamarajanagar', 7),
  ('Karnataka', 'Chikkaballapur', 8),
  ('Karnataka', 'Chikkamagaluru', 9),
  ('Karnataka', 'Chitradurga', 10),
  ('Karnataka', 'Dakshina Kannada', 11),
  ('Karnataka', 'Gadag', 14),
  ('Karnataka', 'Haveri', 16),
  ('Karnataka', 'Kalaburagi (Gulbarga)', 17),
  ('Karnataka', 'Kodagu', 18),
  ('Karnataka', 'Mandya', 21),
  ('Karnataka', 'Ramanagara', 24),
  ('Karnataka', 'Uttara Kannada', 28),
  ('Karnataka', 'Vijayapura', 29),
  ('Karnataka', 'Yadgir', 30),
  ('Karnataka', 'Vijayanagara', 31),
  ('Karnataka', 'Chintamani', 32),
  ('Karnataka', 'Srinivarpura', 33),
  ('Karnataka', 'Sindanore', 34),
  ('Karnataka', 'lingasore', 36),
  ('Karnataka', 'Kundapura', 38),
  ('Karnataka', 'Moodbidire', 39),
  ('Karnataka', 'Belthangdy', 40),
  ('Karnataka', 'Mudol', 41),
  ('Karnataka', 'Jamkandi', 42),
  ('Rajasthan', 'Jhalawar', 10);

DO $$
DECLARE
  missing_states TEXT;
BEGIN
  SELECT STRING_AGG(m.state_name, ', ' ORDER BY m.state_name)
  INTO missing_states
  FROM (
    SELECT DISTINCT seed.state_name
    FROM tmp_city_seed_missing seed
    LEFT JOIN public.states s
      ON LOWER(TRIM(s.state_name)) = LOWER(TRIM(seed.state_name))
    WHERE s.id IS NULL
  ) AS m;

  IF missing_states IS NOT NULL THEN
    RAISE EXCEPTION 'Missing states in public.states for city seed: %', missing_states;
  END IF;
END $$;

CREATE TEMP TABLE tmp_city_seed_resolved AS
SELECT
  s.id AS state_id,
  seed.state_name,
  TRIM(seed.city_name) AS city_name,
  seed.sort_order
FROM tmp_city_seed_missing seed
JOIN public.states s
  ON LOWER(TRIM(s.state_name)) = LOWER(TRIM(seed.state_name));

-- Reactivate case-insensitive matches if they already exist but are inactive.
UPDATE public.cities c
SET is_active = true
FROM tmp_city_seed_resolved seed
WHERE c.state_id = seed.state_id
  AND LOWER(TRIM(c.city_name)) = LOWER(TRIM(seed.city_name))
  AND c.is_active = false;

WITH seed_missing AS (
  SELECT
    seed.state_id,
    seed.city_name,
    seed.sort_order,
    ROW_NUMBER() OVER (
      PARTITION BY seed.state_id
      ORDER BY seed.sort_order, seed.city_name
    ) AS state_seed_rank
  FROM tmp_city_seed_resolved seed
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.cities c
    WHERE c.state_id = seed.state_id
      AND LOWER(TRIM(c.city_name)) = LOWER(TRIM(seed.city_name))
  )
),
state_max_order AS (
  SELECT
    s.state_id,
    COALESCE(MAX(c.display_order), 0) AS max_display_order
  FROM (SELECT DISTINCT state_id FROM tmp_city_seed_resolved) s
  LEFT JOIN public.cities c
    ON c.state_id = s.state_id
  GROUP BY s.state_id
)
INSERT INTO public.cities (
  city_name,
  state_id,
  display_order,
  is_active
)
SELECT
  sm.city_name,
  sm.state_id,
  smo.max_display_order + sm.state_seed_rank,
  true
FROM seed_missing sm
JOIN state_max_order smo
  ON smo.state_id = sm.state_id
ON CONFLICT (city_name, state_id)
DO UPDATE
SET is_active = true;

COMMIT;