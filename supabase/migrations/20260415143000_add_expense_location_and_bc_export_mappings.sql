BEGIN;

CREATE TABLE IF NOT EXISTS public.expense_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_name varchar(150) NOT NULL UNIQUE,
  region_code varchar(150) NOT NULL,
  display_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_locations_active_order
  ON public.expense_locations (is_active, display_order);

CREATE INDEX IF NOT EXISTS idx_expense_locations_region_code
  ON public.expense_locations (region_code);

ALTER TABLE public.expense_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expense_locations_read_all ON public.expense_locations;
CREATE POLICY expense_locations_read_all
  ON public.expense_locations
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS expense_locations_write_service ON public.expense_locations;
CREATE POLICY expense_locations_write_service
  ON public.expense_locations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.expense_locations (location_name, region_code, display_order)
VALUES
  ('Presales-Bangalore', 'KANNADA', 1),
  ('Presales-Bhubaneswar', 'HINDI', 2),
  ('Presales-Bikaner', 'HINDI', 3),
  ('Presales-Chennai', 'TAMIL', 4),
  ('Presales-Coimbatore', 'TAMIL', 5),
  ('Presales-Delhi', 'HINDI', 6),
  ('Presales-Durgapur', 'HINDI', 7),
  ('Presales-Ernakulam', 'MALAYALAM', 8),
  ('Presales-Hubli', 'KANNADA', 9),
  ('Presales-Hyderabad', 'TELUGU', 10),
  ('Presales-Indore', 'HINDI', 11),
  ('Presales-Jaipur', 'HINDI', 12),
  ('Presales-Kochi', 'MALAYALAM', 13),
  ('Presales-Kolkata', 'HINDI', 14),
  ('Presales-Kurnool', 'TELUGU', 15),
  ('Presales-Lucknow', 'HINDI', 16),
  ('Presales-Madurai', 'TAMIL', 17),
  ('Presales-Maharastra', 'MARATHI', 18),
  ('Presales-Mangalore', 'KANNADA', 19),
  ('Presales-Mysore', 'KANNADA', 20),
  ('Presales-Nagpur', 'MARATHI', 21),
  ('Presales-Nashik', 'MARATHI', 22),
  ('Presales-New Delhi', 'HINDI', 23),
  ('Presales-Noida', 'HINDI', 24),
  ('Presales-Odisha', 'HINDI', 25),
  ('Presales-Pune', 'MARATHI', 26),
  ('Presales-Rajahmundry', 'TELUGU', 27),
  ('Presales-Rajasthan', 'HINDI', 28),
  ('Presales-Rourkella', 'HINDI', 29),
  ('Presales-Sangareddy', 'TELUGU', 30),
  ('Presales-Sikar', 'HINDI', 31),
  ('Presales-Siliguri', 'HINDI', 32),
  ('Presales-Tamilnadu', 'TAMIL', 33),
  ('Presales-Tirupathi', 'TELUGU', 34),
  ('Presales-Vijayawada', 'TELUGU', 35),
  ('Presales-Vizag', 'TELUGU', 36),
  ('Presales-Warangal', 'TELUGU', 37),
  ('Presales-West Bengal', 'HINDI', 38),
  ('Office - Hyd Brigade', 'COMMON', 39),
  ('Office - Hyd KKH', 'COMMON', 40),
  ('Office - Hyd Other', 'COMMON', 41),
  ('NIAT - Aurora', 'NIAT - AURORA', 42),
  ('NIAT - Yenepoya Managlore', 'NIAT - YENEPOYA - MA', 43),
  ('NIAT - CDU', 'NIAT - CDU', 44),
  ('NIAT - Takshasila', 'NIAT - TAKSHASILA', 45),
  ('NIAT - S-Vyasa', 'NIAT - S-VYASA', 46),
  ('NIAT - BITS - Farah', 'NIAT - BITS (FARAH)', 47),
  ('NIAT - AMET', 'NIAT - AMET', 48),
  ('NIAT - CIET - LAM', 'NIAT - CIET', 49),
  ('NIAT - NIU', 'NIAT - NIU', 50),
  ('NIAT - ADYPU', 'NIAT - ADYPU', 51),
  ('NIAT - VGU', 'NIAT - VGU', 52),
  ('NIAT - CITY - Mothadaka', 'NIAT - CITY', 53),
  ('NIAT - NSRIT', 'NIAT - NSRIT', 54),
  ('NIAT - NRI', 'NIAT - NRI', 55),
  ('NIAT - Mallareddy', 'NIAT - MALLAREDDY', 56),
  ('NIAT - Annamacharya', 'NIAT - ANNAMACHARYA', 57),
  ('NIAT - SGU', 'NIAT - SGU', 58),
  ('NIAT - Sharda', 'NIAT - SHARDA', 59),
  ('NIAT - Crescent', 'NIAT - CRESCENT', 60),
  ('Other', 'COMMON', 61),
  ('Presales-KERALA', 'MALAYALAM', 62),
  ('Presales-Kota', 'HINDI', 63),
  ('Presales-Karnataka', 'KANNADA', 64)
ON CONFLICT (location_name)
DO UPDATE SET
  region_code = EXCLUDED.region_code,
  display_order = EXCLUDED.display_order,
  is_active = true,
  updated_at = now();

ALTER TABLE public.expense_claims
  ADD COLUMN IF NOT EXISTS expense_location_id uuid REFERENCES public.expense_locations(id);

CREATE INDEX IF NOT EXISTS idx_expense_claims_expense_location_id
  ON public.expense_claims (expense_location_id);

CREATE TABLE IF NOT EXISTS public.expense_type_account_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_item_type text NOT NULL UNIQUE,
  bal_account_no varchar(20) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_type_account_mappings_active_type
  ON public.expense_type_account_mappings (is_active, expense_item_type);

ALTER TABLE public.expense_type_account_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expense_type_account_mappings_read_all
  ON public.expense_type_account_mappings;
CREATE POLICY expense_type_account_mappings_read_all
  ON public.expense_type_account_mappings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS expense_type_account_mappings_write_service
  ON public.expense_type_account_mappings;
CREATE POLICY expense_type_account_mappings_write_service
  ON public.expense_type_account_mappings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.expense_type_account_mappings (expense_item_type, bal_account_no)
VALUES
  ('food', '503063'),
  ('fuel', '535002')
ON CONFLICT (expense_item_type)
DO UPDATE SET
  bal_account_no = EXCLUDED.bal_account_no,
  is_active = true,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.finance_export_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_code varchar(80) NOT NULL UNIQUE,
  account_type varchar(100) NOT NULL,
  employee_transaction_type varchar(100) NOT NULL,
  bal_account_type varchar(100) NOT NULL,
  default_document_no varchar(100) NOT NULL DEFAULT '',
  program_code varchar(80) NOT NULL,
  sub_product_code varchar(80) NOT NULL,
  responsible_dep_code varchar(80) NOT NULL,
  beneficiary_dep_code varchar(80) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_export_profiles_active_code
  ON public.finance_export_profiles (is_active, profile_code);

ALTER TABLE public.finance_export_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_export_profiles_read_all ON public.finance_export_profiles;
CREATE POLICY finance_export_profiles_read_all
  ON public.finance_export_profiles
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS finance_export_profiles_write_service
  ON public.finance_export_profiles;
CREATE POLICY finance_export_profiles_write_service
  ON public.finance_export_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.finance_export_profiles (
  profile_code,
  account_type,
  employee_transaction_type,
  bal_account_type,
  default_document_no,
  program_code,
  sub_product_code,
  responsible_dep_code,
  beneficiary_dep_code
)
VALUES
  (
    'BC_EXPENSE',
    'Employee',
    'ADVANCE',
    'G/L Account',
    '',
    'NIAT',
    'NIAT362',
    'PRE-SALES',
    'PRE-SALES'
  )
ON CONFLICT (profile_code)
DO UPDATE SET
  account_type = EXCLUDED.account_type,
  employee_transaction_type = EXCLUDED.employee_transaction_type,
  bal_account_type = EXCLUDED.bal_account_type,
  default_document_no = EXCLUDED.default_document_no,
  program_code = EXCLUDED.program_code,
  sub_product_code = EXCLUDED.sub_product_code,
  responsible_dep_code = EXCLUDED.responsible_dep_code,
  beneficiary_dep_code = EXCLUDED.beneficiary_dep_code,
  is_active = true,
  updated_at = now();

CREATE INDEX IF NOT EXISTS idx_expense_claim_items_claim_item_type
  ON public.expense_claim_items (claim_id, item_type);

CREATE INDEX IF NOT EXISTS idx_finance_actions_acted_at_id
  ON public.finance_actions (acted_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_expense_claims_created_at_id
  ON public.expense_claims (created_at DESC, id DESC);

COMMIT;
