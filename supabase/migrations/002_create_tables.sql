BEGIN;

create extension if not exists pgcrypto;

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null unique,
  employee_name text not null,
  employee_email text not null unique,
  state text not null,
  designation public.designation_type not null,
  approval_email_level_1 text,
  approval_email_level_2 text,
  approval_email_level_3 text,
  created_at timestamptz not null default now()
);

create table public.expense_reimbursement_rates (
  id uuid primary key default gen_random_uuid(),
  designation public.designation_type not null,
  vehicle_type public.vehicle_type,
  rate_type text not null,
  amount numeric(10, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (designation, vehicle_type, rate_type)
);

create table public.expense_claims (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  claim_date date not null,
  work_location public.work_location_type not null,
  own_vehicle_used boolean,
  vehicle_type public.vehicle_type,
  outstation_location text,
  from_city text,
  to_city text,
  km_travelled numeric(10, 2) check (km_travelled >= 0),
  total_amount numeric(10, 2) not null default 0 check (total_amount >= 0),
  status public.claim_status not null default 'draft',
  current_approval_level int,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, claim_date)
);

create table public.expense_claim_items (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.expense_claims(id) on delete cascade,
  item_type public.expense_item_type not null,
  description text,
  amount numeric(10, 2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create table public.approval_history (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.expense_claims(id) on delete cascade,
  approver_email text not null,
  approval_level int not null check (approval_level between 1 and 3),
  action public.approval_action_type not null,
  notes text,
  acted_at timestamptz not null default now()
);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_expense_claims_updated_at
before update on public.expense_claims
for each row
execute function public.update_updated_at_column();

COMMIT;
