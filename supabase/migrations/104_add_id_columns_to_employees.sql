-- Migration 104: Add ID-based columns to employees table
-- Purpose: Add designation_id, employee_status_id FKs to existing employees table
-- Also create employee_states junction table (employees can belong to multiple states)
-- Part of: Phase 1 - Master Tables (ID-Based Architecture Migration)
-- CRITICAL: Preserves existing data. Additive only — no columns dropped.

BEGIN;

-- =============================================================================
-- 1. Add new ID-based columns to employees table
-- =============================================================================
ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS designation_id UUID REFERENCES public.designations(id),
    ADD COLUMN IF NOT EXISTS employee_status_id UUID REFERENCES public.employee_statuses(id),
    ADD COLUMN IF NOT EXISTS date_of_joining DATE,
    ADD COLUMN IF NOT EXISTS date_of_leaving DATE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- =============================================================================
-- 2. Populate designation_id from existing designation text column
-- =============================================================================
UPDATE public.employees e
SET designation_id = d.id
FROM public.designations d
WHERE e.designation::text = d.designation_name;

-- =============================================================================
-- 3. Populate employee_status_id (all existing = Active)
-- =============================================================================
UPDATE public.employees e
SET employee_status_id = es.id
FROM public.employee_statuses es
WHERE es.status_code = 'ACTIVE';

-- =============================================================================
-- 4. Make columns NOT NULL after population
-- =============================================================================
ALTER TABLE public.employees
    ALTER COLUMN designation_id SET NOT NULL,
    ALTER COLUMN employee_status_id SET NOT NULL;

-- =============================================================================
-- 5. Create employee_states junction table
-- (employees can belong to multiple states, e.g. "Tamil Nadu, Kerala")
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.employee_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    state_id UUID NOT NULL REFERENCES public.states(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(employee_id, state_id)
);

COMMENT ON TABLE public.employee_states IS 'Junction table: employees to states (many-to-many)';
COMMENT ON COLUMN public.employee_states.is_primary IS 'True for the employees primary operating state';

-- =============================================================================
-- 6. Populate employee_states from existing text state column
-- Handle "All States" employees by assigning all active states
-- Handle comma-separated states like "Tamil Nadu, Kerala"
-- =============================================================================

-- For employees with "All States"
INSERT INTO public.employee_states (employee_id, state_id, is_primary)
SELECT e.id, s.id, false
FROM public.employees e
CROSS JOIN public.states s
WHERE e.state = 'All States'
  AND s.is_active = true
ON CONFLICT (employee_id, state_id) DO NOTHING;

-- For employees with single state (no commas, not "All States")
INSERT INTO public.employee_states (employee_id, state_id, is_primary)
SELECT e.id, s.id, true
FROM public.employees e
JOIN public.states s ON s.state_name = TRIM(e.state)
WHERE e.state NOT LIKE '%,%'
  AND e.state != 'All States'
ON CONFLICT (employee_id, state_id) DO NOTHING;

-- For employees with comma-separated states (e.g. "Tamil Nadu, Kerala")
-- Handle "Maharastra" spelling variant → "Maharashtra" 
INSERT INTO public.employee_states (employee_id, state_id, is_primary)
SELECT DISTINCT e.id, s.id, false
FROM public.employees e,
     LATERAL unnest(string_to_array(e.state, ',')) AS raw_state_name,
     LATERAL (SELECT TRIM(raw_state_name) AS trimmed_name) tn
JOIN public.states s ON (
    s.state_name = tn.trimmed_name
    OR (tn.trimmed_name = 'Maharastra' AND s.state_name = 'Maharashtra')
)
WHERE e.state LIKE '%,%'
  AND e.state != 'All States'
ON CONFLICT (employee_id, state_id) DO NOTHING;

-- Set first state as primary for multi-state employees
UPDATE public.employee_states es
SET is_primary = true
WHERE es.id = (
    SELECT es2.id
    FROM public.employee_states es2
    WHERE es2.employee_id = es.employee_id
    ORDER BY es2.created_at ASC
    LIMIT 1
)
AND NOT EXISTS (
    SELECT 1 FROM public.employee_states es3
    WHERE es3.employee_id = es.employee_id
      AND es3.is_primary = true
);

-- =============================================================================
-- 7. Create indexes on new columns
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_employees_designation_id ON public.employees(designation_id);
CREATE INDEX IF NOT EXISTS idx_employees_status_id ON public.employees(employee_status_id);
CREATE INDEX IF NOT EXISTS idx_employee_states_employee ON public.employee_states(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_states_state ON public.employee_states(state_id);
CREATE INDEX IF NOT EXISTS idx_employee_states_primary ON public.employee_states(employee_id) WHERE is_primary = true;

-- =============================================================================
-- 8. Enable RLS on employee_states
-- =============================================================================
ALTER TABLE public.employee_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_states_read_all"
    ON public.employee_states
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "employee_states_admin_write"
    ON public.employee_states
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMIT;
