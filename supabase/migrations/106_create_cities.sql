-- Migration 106: Create cities master table
-- Purpose: Replace free-text city names in claims with ID-based lookups
-- Part of: Phase 1 - Master Tables (ID-Based Architecture Migration)

BEGIN;

-- =============================================================================
-- 1. Create cities table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_name VARCHAR(255) NOT NULL,
    state_id UUID NOT NULL REFERENCES public.states(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(city_name, state_id)
);

COMMENT ON TABLE public.cities IS 'Master table for cities. Used for outstation travel claims.';

-- =============================================================================
-- 2. Seed data — major cities per state
-- =============================================================================

-- Andhra Pradesh
INSERT INTO public.cities (city_name, state_id, display_order)
SELECT city, s.id, ord
FROM public.states s,
     (VALUES
        ('Visakhapatnam', 1), ('Vijayawada', 2), ('Guntur', 3),
        ('Tirupati', 4), ('Kakinada', 5), ('Rajahmundry', 6),
        ('Nellore', 7), ('Kurnool', 8), ('Anantapur', 9),
        ('Ongole', 10), ('Eluru', 11), ('Srikakulam', 12)
     ) AS cities(city, ord)
WHERE s.state_code = 'AP'
ON CONFLICT (city_name, state_id) DO NOTHING;

-- Telangana
INSERT INTO public.cities (city_name, state_id, display_order)
SELECT city, s.id, ord
FROM public.states s,
     (VALUES
        ('Hyderabad', 1), ('Warangal', 2), ('Nizamabad', 3),
        ('Karimnagar', 4), ('Khammam', 5), ('Mahbubnagar', 6),
        ('Nalgonda', 7), ('Adilabad', 8), ('Medak', 9),
        ('Rangareddy', 10), ('Secunderabad', 11)
     ) AS cities(city, ord)
WHERE s.state_code = 'TG'
ON CONFLICT (city_name, state_id) DO NOTHING;

-- Tamil Nadu
INSERT INTO public.cities (city_name, state_id, display_order)
SELECT city, s.id, ord
FROM public.states s,
     (VALUES
        ('Chennai', 1), ('Coimbatore', 2), ('Madurai', 3),
        ('Tiruchirappalli', 4), ('Salem', 5), ('Tirunelveli', 6),
        ('Erode', 7), ('Vellore', 8), ('Thanjavur', 9),
        ('Dindigul', 10), ('Thoothukudi', 11)
     ) AS cities(city, ord)
WHERE s.state_code = 'TN'
ON CONFLICT (city_name, state_id) DO NOTHING;

-- Kerala
INSERT INTO public.cities (city_name, state_id, display_order)
SELECT city, s.id, ord
FROM public.states s,
     (VALUES
        ('Thiruvananthapuram', 1), ('Kochi', 2), ('Kozhikode', 3),
        ('Thrissur', 4), ('Kollam', 5), ('Kannur', 6),
        ('Alappuzha', 7), ('Palakkad', 8), ('Malappuram', 9),
        ('Kottayam', 10)
     ) AS cities(city, ord)
WHERE s.state_code = 'KL'
ON CONFLICT (city_name, state_id) DO NOTHING;

-- Karnataka
INSERT INTO public.cities (city_name, state_id, display_order)
SELECT city, s.id, ord
FROM public.states s,
     (VALUES
        ('Bengaluru', 1), ('Mysuru', 2), ('Hubli-Dharwad', 3),
        ('Mangaluru', 4), ('Belagavi', 5), ('Davanagere', 6),
        ('Ballari', 7), ('Tumakuru', 8), ('Shivamogga', 9),
        ('Raichur', 10), ('Udupi', 11)
     ) AS cities(city, ord)
WHERE s.state_code = 'KA'
ON CONFLICT (city_name, state_id) DO NOTHING;

-- Maharashtra
INSERT INTO public.cities (city_name, state_id, display_order)
SELECT city, s.id, ord
FROM public.states s,
     (VALUES
        ('Mumbai', 1), ('Pune', 2), ('Nagpur', 3),
        ('Nashik', 4), ('Aurangabad', 5), ('Thane', 6),
        ('Solapur', 7), ('Kolhapur', 8), ('Amravati', 9),
        ('Navi Mumbai', 10), ('Vasai-Virar', 11)
     ) AS cities(city, ord)
WHERE s.state_code = 'MH'
ON CONFLICT (city_name, state_id) DO NOTHING;

-- Rajasthan
INSERT INTO public.cities (city_name, state_id, display_order)
SELECT city, s.id, ord
FROM public.states s,
     (VALUES
        ('Jaipur', 1), ('Jodhpur', 2), ('Udaipur', 3),
        ('Kota', 4), ('Ajmer', 5), ('Bikaner', 6),
        ('Bhilwara', 7), ('Alwar', 8), ('Sikar', 9)
     ) AS cities(city, ord)
WHERE s.state_code = 'RJ'
ON CONFLICT (city_name, state_id) DO NOTHING;

-- Delhi NCR
INSERT INTO public.cities (city_name, state_id, display_order)
SELECT city, s.id, ord
FROM public.states s,
     (VALUES
        ('New Delhi', 1), ('Noida', 2), ('Gurugram', 3),
        ('Faridabad', 4), ('Ghaziabad', 5), ('Greater Noida', 6)
     ) AS cities(city, ord)
WHERE s.state_code = 'DL'
ON CONFLICT (city_name, state_id) DO NOTHING;

-- Uttar Pradesh
INSERT INTO public.cities (city_name, state_id, display_order)
SELECT city, s.id, ord
FROM public.states s,
     (VALUES
        ('Lucknow', 1), ('Kanpur', 2), ('Agra', 3),
        ('Varanasi', 4), ('Prayagraj', 5), ('Meerut', 6),
        ('Bareilly', 7), ('Aligarh', 8), ('Moradabad', 9),
        ('Gorakhpur', 10)
     ) AS cities(city, ord)
WHERE s.state_code = 'UP'
ON CONFLICT (city_name, state_id) DO NOTHING;

-- West Bengal
INSERT INTO public.cities (city_name, state_id, display_order)
SELECT city, s.id, ord
FROM public.states s,
     (VALUES
        ('Kolkata', 1), ('Howrah', 2), ('Durgapur', 3),
        ('Asansol', 4), ('Siliguri', 5), ('Bardhaman', 6),
        ('Malda', 7), ('Kharagpur', 8)
     ) AS cities(city, ord)
WHERE s.state_code = 'WB'
ON CONFLICT (city_name, state_id) DO NOTHING;

-- Odisha
INSERT INTO public.cities (city_name, state_id, display_order)
SELECT city, s.id, ord
FROM public.states s,
     (VALUES
        ('Bhubaneswar', 1), ('Cuttack', 2), ('Rourkela', 3),
        ('Berhampur', 4), ('Sambalpur', 5), ('Puri', 6),
        ('Balasore', 7), ('Jharsuguda', 8)
     ) AS cities(city, ord)
WHERE s.state_code = 'OD'
ON CONFLICT (city_name, state_id) DO NOTHING;

-- =============================================================================
-- 3. Create indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_cities_state ON public.cities(state_id);
CREATE INDEX IF NOT EXISTS idx_cities_active ON public.cities(is_active);
CREATE INDEX IF NOT EXISTS idx_cities_name ON public.cities(city_name);

-- =============================================================================
-- 4. Enable RLS
-- =============================================================================
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cities_read_all"
    ON public.cities
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "cities_admin_write"
    ON public.cities
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMIT;
