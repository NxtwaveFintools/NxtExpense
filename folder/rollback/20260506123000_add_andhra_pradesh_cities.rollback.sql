-- Rollback for 20260506123000_add_andhra_pradesh_cities.sql
-- Deletes only rows inserted by that migration marker timestamp.

DO $$
DECLARE
  v_state_id UUID;
  v_deleted_count INTEGER := 0;
BEGIN
  SELECT id
  INTO v_state_id
  FROM public.states
  WHERE state_name = 'Andhra Pradesh'
  LIMIT 1;

  IF v_state_id IS NULL THEN
    RAISE NOTICE 'State "Andhra Pradesh" not found; nothing to rollback';
    RETURN;
  END IF;

  DELETE FROM public.cities
  WHERE state_id = v_state_id
    AND city_name IN (
      'Anantapur',
      'Chittor',
      'Pileru',
      'Kalyandurgam',
      'Hindupur',
      'Kadiri',
      'Narasaraopet',
      'Peddapuram',
      'Samalkot',
      'Mandapeta',
      'Ramachandrapuram',
      'Kothapeta',
      'Kovvur',
      'Pedana',
      'Repalle',
      'Ponnur',
      'Giddalur',
      'Dharmavaram',
      'Proddatur',
      'Jammalamadugu',
      'Punganur',
      'Atmakur',
      'Parvathipuram'
    )
    AND created_at = TIMESTAMPTZ '2026-05-06 12:30:00+00';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Andhra Pradesh cities rollback deleted % rows', v_deleted_count;
END $$;
