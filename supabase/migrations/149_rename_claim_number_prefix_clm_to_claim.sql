-- Migration 149: Rename claim number prefix from CLM to CLAIM
-- Updates: all existing records + generate_claim_number function

-- Step 1: Update all existing claim numbers from CLM- to CLAIM-
UPDATE public.expense_claims
SET claim_number = 'CLAIM-' || substr(claim_number, 5)
WHERE claim_number LIKE 'CLM-%';

-- Step 2: Drop and recreate generate_claim_number with CLAIM prefix
DROP FUNCTION IF EXISTS public.generate_claim_number(uuid, date);

CREATE OR REPLACE FUNCTION public.generate_claim_number(p_employee_uuid uuid, p_claim_date date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_employee_code text;
  v_sequence_value bigint;
begin
  select e.employee_id
  into v_employee_code
  from public.employees e
  where e.id = p_employee_uuid;

  if v_employee_code is null then
    raise exception 'Employee code not found for claim number generation.';
  end if;

  v_sequence_value := nextval('public.claim_number_seq');

  return format(
    'CLAIM-%s-%s-%s',
    upper(regexp_replace(v_employee_code, '[^A-Za-z0-9]', '', 'g')),
    to_char(p_claim_date, 'DDMMYY'),
    lpad(v_sequence_value::text, 4, '0')
  );
end;
$function$;
