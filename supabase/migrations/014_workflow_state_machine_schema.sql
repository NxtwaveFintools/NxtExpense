alter type public.claim_status add value if not exists 'returned_for_modification';

alter type public.approval_action_type add value if not exists 'resubmitted';
alter type public.approval_action_type add value if not exists 'bypass_logged';
alter type public.approval_action_type add value if not exists 'admin_override';
alter type public.approval_action_type add value if not exists 'finance_issued';
alter type public.approval_action_type add value if not exists 'finance_rejected';
alter type public.approval_action_type add value if not exists 'reopened';

alter type public.designation_type add value if not exists 'Admin';
alter type public.finance_action_type add value if not exists 'reopened';

alter table public.expense_claims
add column if not exists tenant_id text not null default 'default',
add column if not exists resubmission_count int not null default 0,
add column if not exists last_rejection_notes text,
add column if not exists last_rejected_by_email text,
add column if not exists last_rejected_at timestamptz;

alter table public.expense_claims
drop constraint if exists expense_claims_resubmission_count_check;

alter table public.expense_claims
add constraint expense_claims_resubmission_count_check
check (resubmission_count >= 0);

alter table public.approval_history
alter column approval_level drop not null;

alter table public.approval_history
drop constraint if exists approval_history_approval_level_check;

alter table public.approval_history
add constraint approval_history_approval_level_check
check (approval_level is null or approval_level between 1 and 3);

alter table public.approval_history
add column if not exists rejection_notes text,
add column if not exists allow_resubmit boolean,
add column if not exists bypass_reason text,
add column if not exists skipped_levels jsonb,
add column if not exists reason text,
add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'claim_actor_scope'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.claim_actor_scope as enum (
      'employee',
      'approver',
      'finance',
      'admin'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'claim_next_level_mode'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.claim_next_level_mode as enum (
      'retain',
      'next_configured',
      'reset_first_configured',
      'clear'
    );
  end if;
end;
$$;

create table if not exists public.claim_status_catalog (
  status public.claim_status primary key,
  display_label text not null,
  is_terminal boolean not null default false,
  sort_order int not null,
  color_token text not null default 'neutral',
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.claim_transition_graph (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'default',
  from_status public.claim_status not null,
  to_status public.claim_status not null,
  to_status_when_no_next public.claim_status,
  trigger_action text not null,
  action_label text not null,
  actor_scope public.claim_actor_scope not null,
  allowed_approver_levels int[],
  require_notes boolean not null default false,
  allow_resubmit boolean,
  next_level_mode public.claim_next_level_mode not null default 'retain',
  bypass_reason_template text,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_claim_transition_graph_lookup
on public.claim_transition_graph (
  tenant_id,
  from_status,
  trigger_action,
  actor_scope,
  is_active
);

create index if not exists idx_claim_transition_graph_levels
on public.claim_transition_graph
using gin (allowed_approver_levels);

create table if not exists public.claim_status_audit (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.expense_claims(id) on delete cascade,
  actor_email text not null,
  actor_scope public.claim_actor_scope not null,
  trigger_action text not null,
  from_status public.claim_status not null,
  to_status public.claim_status not null,
  from_approval_level int,
  to_approval_level int,
  allow_resubmit boolean,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  changed_at timestamptz not null default now()
);

create index if not exists idx_claim_status_audit_claim_id
on public.claim_status_audit (claim_id, changed_at desc);

drop trigger if exists trg_claim_transition_graph_updated_at on public.claim_transition_graph;

create trigger trg_claim_transition_graph_updated_at
before update on public.claim_transition_graph
for each row
execute function public.update_updated_at_column();

alter table public.claim_status_catalog enable row level security;
alter table public.claim_transition_graph enable row level security;
alter table public.claim_status_audit enable row level security;

create policy "authenticated users can read claim status catalog"
on public.claim_status_catalog
for select
to authenticated
using (true);

create policy "authenticated users can read claim transition graph"
on public.claim_transition_graph
for select
to authenticated
using (is_active = true);

create policy "participants can read claim status audit"
on public.claim_status_audit
for select
to authenticated
using (
  exists (
    select 1
    from public.expense_claims c
    join public.employees owner_emp on owner_emp.id = c.employee_id
    left join public.employees current_emp
      on lower(current_emp.employee_email) = public.current_user_email()
    where c.id = claim_status_audit.claim_id
      and (
        lower(owner_emp.employee_email) = public.current_user_email()
        or lower(coalesce(owner_emp.approval_email_level_1, '')) = public.current_user_email()
        or lower(coalesce(owner_emp.approval_email_level_2, '')) = public.current_user_email()
        or lower(coalesce(owner_emp.approval_email_level_3, '')) = public.current_user_email()
        or current_emp.designation::text in ('Finance', 'Admin')
      )
  )
);
