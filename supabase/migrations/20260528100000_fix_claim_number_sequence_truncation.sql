-- Fix: claim_number suffix collisions once the sequence passes 9999
--
-- Root cause:
--   generate_claim_number() built the trailing counter with
--     lpad(v_sequence_value::text, 4, '0')
--   PostgreSQL's lpad TRUNCATES (from the right) when the input is longer than
--   the target width. Once claim_number_seq advanced past 9999, every claim
--   silently dropped its trailing digits:
--     lpad('32718', 4, '0')  ->  '3271'
--   so CLAIM-NWxxxx-DDMMYY-3271 was produced for many distinct sequence values
--   (32710..32719 all collapse to '3271'). The full claim_number stayed unique
--   only because the date/employee differ, but the human-facing suffix became
--   meaningless and visibly duplicated.
--
-- Fix:
--   Pad to a MINIMUM of 4 digits but never truncate, using a width that grows
--   with the value:
--     lpad(v::text, greatest(4, length(v::text)), '0')
--   Verified:
--     5       -> 0005     9999    -> 9999
--     208     -> 0208     10000   -> 10000
--     32718   -> 32718    1234567 -> 1234567
--   Small values keep the original zero-padded look; large values keep all
--   digits. Scales indefinitely (lakhs / millions of claims).
--
-- Scope:
--   Only affects claim numbers generated AFTER this migration. Existing rows are
--   not rewritten (their full claim_number is already unique). Function
--   signature, trigger, and calling code are unchanged.

CREATE OR REPLACE FUNCTION public.generate_claim_number(
  p_employee_uuid uuid,
  p_claim_date date
)
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
    lpad(
      v_sequence_value::text,
      greatest(4, length(v_sequence_value::text)),
      '0'
    )
  );
end;
$function$;
