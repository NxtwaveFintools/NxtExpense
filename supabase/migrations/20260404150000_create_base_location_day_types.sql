BEGIN;

CREATE TABLE IF NOT EXISTS public.base_location_day_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_type_code varchar(50) UNIQUE NOT NULL,
  day_type_label varchar(120) NOT NULL,
  include_food_allowance boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_base_location_day_types_active_order
  ON public.base_location_day_types (is_active, display_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_base_location_day_types_single_default
  ON public.base_location_day_types (is_default)
  WHERE is_default = true AND is_active = true;

ALTER TABLE public.base_location_day_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'base_location_day_types'
      AND policyname = 'base_location_day_types_read_all'
  ) THEN
    CREATE POLICY base_location_day_types_read_all
      ON public.base_location_day_types
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'base_location_day_types'
      AND policyname = 'base_location_day_types_write_service'
  ) THEN
    CREATE POLICY base_location_day_types_write_service
      ON public.base_location_day_types
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

INSERT INTO public.base_location_day_types (
  day_type_code,
  day_type_label,
  include_food_allowance,
  is_default,
  display_order,
  is_active
)
VALUES
  ('FULL_DAY', 'Full Day', true, true, 1, true),
  ('HALF_DAY', 'Half Day (Fuel Only)', false, false, 2, true)
ON CONFLICT (day_type_code)
DO UPDATE SET
  day_type_label = EXCLUDED.day_type_label,
  include_food_allowance = EXCLUDED.include_food_allowance,
  is_default = EXCLUDED.is_default,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

COMMIT;
