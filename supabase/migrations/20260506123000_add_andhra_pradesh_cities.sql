-- Add requested cities under Andhra Pradesh without hardcoded state IDs.
-- Idempotent insertion: skips existing (city_name, state_id) rows.

DO $$
DECLARE
  v_state_id UUID;
  v_inserted_count INTEGER := 0;
BEGIN
  SELECT id
  INTO v_state_id
  FROM public.states
  WHERE state_name = 'Andhra Pradesh'
  LIMIT 1;

  IF v_state_id IS NULL THEN
    RAISE EXCEPTION 'State "Andhra Pradesh" not found in public.states';
  END IF;

  WITH requested(city_name) AS (
    VALUES
      ('Anantapur'),
      ('Chittor'),
      ('Pileru'),
      ('Kalyandurgam'),
      ('Hindupur'),
      ('Kadiri'),
      ('Narasaraopet'),
      ('Peddapuram'),
      ('Samalkot'),
      ('Mandapeta'),
      ('Ramachandrapuram'),
      ('Kothapeta'),
      ('Kovvur'),
      ('Pedana'),
      ('Repalle'),
      ('Ponnur'),
      ('Giddalur'),
      ('Dharmavaram'),
      ('Kadiri'),
      ('Proddatur'),
      ('Jammalamadugu'),
      ('Punganur'),
      ('Atmakur'),
      ('Parvathipuram')
  ),
  deduped AS (
    SELECT DISTINCT city_name
    FROM requested
  ),
  missing AS (
    SELECT d.city_name
    FROM deduped d
    LEFT JOIN public.cities c
      ON c.city_name = d.city_name
     AND c.state_id = v_state_id
    WHERE c.id IS NULL
  ),
  inserted AS (
    INSERT INTO public.cities (city_name, state_id, is_active, display_order, created_at)
    SELECT
      m.city_name,
      v_state_id,
      true,
      0,
      TIMESTAMPTZ '2026-05-06 12:30:00+00'
    FROM missing m
    RETURNING 1
  )
  SELECT COUNT(*)
  INTO v_inserted_count
  FROM inserted;

  RAISE NOTICE 'Andhra Pradesh cities migration inserted % rows', v_inserted_count;
END $$;
