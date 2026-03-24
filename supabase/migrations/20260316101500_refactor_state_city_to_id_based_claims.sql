-- Migration 20260316101500: Refactor state-city architecture to full ID-based claims flow.
-- Source of truth for city master data: .github/knowledge/cities.json

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Sync city master data from knowledge JSON into public.cities
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE tmp_city_seed (
  state_name TEXT NOT NULL,
  city_name TEXT NOT NULL,
  display_order INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_city_seed (state_name, city_name, display_order)
SELECT
  TRIM(state_entry.key) AS state_name,
  TRIM(city_entry.value) AS city_name,
  city_entry.ordinality::INTEGER AS display_order
FROM jsonb_each(
  $json${"Tamil Nadu":["Ariyalur","Chengalpattu","Chennai","Coimbatore","Cuddalore","Dharmapuri","Dindigul","Erode","Kallakurichi","Kanchipuram","Kanyakumari","Karur","Krishnagiri","Madurai","Mayiladuthurai","Nagapattinam","Namakkal","Nilgiris","Perambalur","Pudukkottai","Ramanathapuram","Ranipet","Salem","Sivagangai","Tenkasi","Thanjavur","Theni","Thoothukudi","Tiruchirappalli","Tirunelveli","Tirupathur","Tiruppur","Tiruvallur","Tiruvannamalai","Tiruvarur","Vellore","Viluppuram","Virudhunagar"],"Kerala":["Thiruvananthapuram","Kollam","Pathanamthitta","Alappuzha","Kottayam","Idukki","Ernakulam","Thrissur","Palakkad","Malappuram","Kozhikode","Wayanad","Kannur","Kasaragod"],"Delhi NCR":["Loni","Mathura","Nagloi","Noida (inc. Sec 22, 26, 29)","North Delhi","Nuh","Palwal","Rewari","South Delhi","South East Delhi","West Delhi","Agra","Central Delhi","Dadri","East Delhi","Etawah","Bhallabhgarh","Faridabad","Gautam Buddh Nagar (GB Nagar)","Ghaziabad (Ghaziyabad)","Greater Noida","Gurgaon (Gurugram)"],"Karnataka":["Bangalopre South","bangalore North","Mysore","Chikkabalapur","Kolar","Davangere","Dharwad","Chikkabalapur","Chithradurga","mangalore","Udupi","Hassan","Thumkur","Ballari","Bidar","Hospet","Koppal","Mulabagal"],"Maharashtra":["Pune","Baramati","Nagpur","Kolhapur","Nashik","Ch Sambhaji Nagar"],"Uttar Pradesh":["Agra","Aligarh","Ambedkar Nagar","Amethi","Amroha","Auraiya","Ayodhya","Azamgarh","Baghpat","Bahraich","Ballia","Balrampur","Banda","Barabanki","Bareilly","Basti","Bijnor","Budaun","Bulandshahr","Chandauli","Chitrakoot","Deoria","Etah","Etawah","Farrukhabad","Fatehpur","Firozabad","Gautam Buddha Nagar","Ghaziabad","Ghazipur","Gonda","Gorakhpur","Hamirpur","Hapur","Hardoi","Hathras","Jalaun","Jaunpur","Jhansi","Kannauj","Kanpur Dehat","Kanpur Nagar","Kasganj","Kaushambi","Kushinagar","Lakhimpur Kheri","Lalitpur","Lucknow","Maharajganj","Mahoba","Mainpuri","Mathura","Mau","Meerut","Mirzapur","Moradabad","Muzaffarnagar","Pilibhit","Pratapgarh","Prayagraj","Raebareli","Rampur","Saharanpur","Sambhal","Sant Kabir Nagar","Sant Ravidas Nagar (Bhadohi)","Shahjahanpur","Shamli","Shravasti","Siddharthnagar","Sitapur","Sonbhadra","Sultanpur","Unnao","Varanasi"],"Andhra Pradesh":["Tirupati","Manadapalli","Srikalahasthi","Raychoti","Puturu","Karnool","Kadapa","Nadiyala","Puduturu","Maidakuru","Badval","Vizag","Yendada","Stadium","Maduravada","Boyyapalem","Peedipalem","Talavalasa","NAD","Gajuvaka","PM Palem","Srikakulam","Ranastalam","Palasa","Takale","Anakapalli","Kurranamapallem","Steel plant","Vijayanagaram","Bobili","Rajam","Rajamundary","Kakinada","Amalapuram","Rajolu","Vijayawada","Nandigama","Jaggayyapeta","Nuzivedu","Vissanapeta","Tiruvuru","Mangalagiri","Vyuru","Tadepalligudam","Tanuku","Bhimavaram","Nellore","Ongole","Kavali","Sulurupeta","Naidupeta","Guduru","Narasapeta","Chilakaluripeta","Guntur","Bapatla","Chirala","Tenali","Vinukonda","Satanapalli","Pidugurala","Kandukuru","Markapuram","Gudavalli","Nidamanuru","Gollapudi","Vuyuru","Gudivada","Machilipatanam","Eluru","Pallakollu","Jangareddygudam","Narsapur"],"Telangana":["Hyderabad","Adilabad","Gadwal","Wanaparthy","Nagarkurnool","Mahabubnagar","Medchal","Yadadri bhuavangiri","Jangaon","Warangal","Hanamakonda","Jayashankar","Nalgonda","Suryapet","Khammam","Bhadradri kothagudem","Mahabubabad","Medak","Siddipet","Sangareddy","Karimnagar","Peddapalle","Mancherial","Jagtial","Nizamabad","Kamareddy","Vikarabad","NIrmal","Sircilla","Kumuram Bheem","Narayanpet","Tandur","Zaheerabad","Sadasvipet","Gajwel","Miryalaguda","Kodad","Shamshabad","Bodhan","Bhainsa","Asifabad","Utnoor","Secunderabad","Malkajgiri"],"Odisha":["Bhubaneswar","Cuttack","rourkela","Berhampur","Koraput","Malkangiri","Bargad","Balasore","Dhenkanal","Keonjhar","Angul"],"West Bengal":["Kolkata","Bankura","Howrah","Medinipur"]}$json$::jsonb
) AS state_entry
CROSS JOIN LATERAL jsonb_array_elements_text(state_entry.value)
  WITH ORDINALITY AS city_entry(value, ordinality)
WHERE TRIM(city_entry.value) <> '';

DO $$
DECLARE
  missing_states TEXT;
BEGIN
  SELECT STRING_AGG(m.state_name, ', ' ORDER BY m.state_name)
  INTO missing_states
  FROM (
    SELECT DISTINCT seed.state_name
    FROM tmp_city_seed seed
    LEFT JOIN public.states s
      ON LOWER(TRIM(s.state_name)) = LOWER(TRIM(seed.state_name))
    WHERE s.id IS NULL
  ) AS m;

  IF missing_states IS NOT NULL THEN
    RAISE EXCEPTION 'cities.json contains state names missing in public.states: %', missing_states;
  END IF;
END $$;

CREATE TEMP TABLE tmp_city_seed_dedup AS
SELECT DISTINCT ON (s.id, LOWER(seed.city_name))
  s.id AS state_id,
  seed.city_name,
  seed.display_order
FROM tmp_city_seed seed
JOIN public.states s
  ON LOWER(TRIM(s.state_name)) = LOWER(TRIM(seed.state_name))
ORDER BY s.id, LOWER(seed.city_name), seed.display_order;

-- Update existing rows (case-insensitive city match within same state)
UPDATE public.cities c
SET
  city_name = seed.city_name,
  display_order = seed.display_order,
  is_active = true
FROM tmp_city_seed_dedup seed
WHERE c.state_id = seed.state_id
  AND LOWER(TRIM(c.city_name)) = LOWER(TRIM(seed.city_name));

-- Insert rows missing from current city master
INSERT INTO public.cities (city_name, state_id, display_order, is_active)
SELECT
  seed.city_name,
  seed.state_id,
  seed.display_order,
  true
FROM tmp_city_seed_dedup seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.cities c
  WHERE c.state_id = seed.state_id
    AND LOWER(TRIM(c.city_name)) = LOWER(TRIM(seed.city_name))
)
ON CONFLICT (city_name, state_id)
DO UPDATE
SET
  display_order = EXCLUDED.display_order,
  is_active = true;

-- For states covered by cities.json, deactivate stale city rows not present in source
UPDATE public.cities c
SET is_active = false
WHERE c.state_id IN (SELECT DISTINCT state_id FROM tmp_city_seed_dedup)
  AND NOT EXISTS (
    SELECT 1
    FROM tmp_city_seed_dedup seed
    WHERE seed.state_id = c.state_id
      AND LOWER(TRIM(seed.city_name)) = LOWER(TRIM(c.city_name))
  );

-- ---------------------------------------------------------------------------
-- 2) Persist state_id on claims for outstation entries
-- ---------------------------------------------------------------------------
ALTER TABLE public.expense_claims
  ADD COLUMN IF NOT EXISTS outstation_state_id UUID REFERENCES public.states(id);

UPDATE public.expense_claims ec
SET outstation_state_id = c.state_id
FROM public.cities c
WHERE ec.outstation_city_id = c.id
  AND (ec.outstation_state_id IS NULL OR ec.outstation_state_id <> c.state_id);

-- Fallback backfill for legacy rows where outstation city may be null but route cities exist
UPDATE public.expense_claims ec
SET outstation_state_id = c.state_id
FROM public.cities c
WHERE ec.outstation_state_id IS NULL
  AND ec.from_city_id = c.id;

UPDATE public.expense_claims ec
SET outstation_state_id = c.state_id
FROM public.cities c
WHERE ec.outstation_state_id IS NULL
  AND ec.to_city_id = c.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'expense_claims_outstation_city_requires_state'
      AND conrelid = 'public.expense_claims'::regclass
  ) THEN
    ALTER TABLE public.expense_claims
      ADD CONSTRAINT expense_claims_outstation_city_requires_state
      CHECK (outstation_city_id IS NULL OR outstation_state_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'expense_claims_from_city_requires_state'
      AND conrelid = 'public.expense_claims'::regclass
  ) THEN
    ALTER TABLE public.expense_claims
      ADD CONSTRAINT expense_claims_from_city_requires_state
      CHECK (from_city_id IS NULL OR outstation_state_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'expense_claims_to_city_requires_state'
      AND conrelid = 'public.expense_claims'::regclass
  ) THEN
    ALTER TABLE public.expense_claims
      ADD CONSTRAINT expense_claims_to_city_requires_state
      CHECK (to_city_id IS NULL OR outstation_state_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_expense_claims_outstation_state_id
  ON public.expense_claims(outstation_state_id);

COMMIT;

