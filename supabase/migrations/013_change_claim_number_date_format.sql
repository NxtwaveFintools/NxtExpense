create or replace function public.generate_claim_number(
  p_employee_uuid uuid,
  p_claim_date date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
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
    'CLM-%s-%s-%s',
    upper(regexp_replace(v_employee_code, '[^A-Za-z0-9]', '', 'g')),
    to_char(p_claim_date, 'DDMMYY'),
    lpad(v_sequence_value::text, 4, '0')
  );
end;
$$;
