create sequence if not exists public.claim_number_seq;

alter table public.expense_claims
add column if not exists claim_number text;

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
    to_char(p_claim_date, 'YYMMDD'),
    lpad(v_sequence_value::text, 4, '0')
  );
end;
$$;

create or replace function public.set_claim_number_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(new.claim_number), '') = '' then
    new.claim_number := public.generate_claim_number(new.employee_id, new.claim_date);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_expense_claims_claim_number on public.expense_claims;

create trigger trg_expense_claims_claim_number
before insert on public.expense_claims
for each row
execute function public.set_claim_number_before_insert();

update public.expense_claims c
set claim_number = public.generate_claim_number(c.employee_id, c.claim_date)
where coalesce(trim(c.claim_number), '') = '';

alter table public.expense_claims
alter column claim_number set not null;

create unique index if not exists idx_expense_claims_claim_number_unique
on public.expense_claims(claim_number);
