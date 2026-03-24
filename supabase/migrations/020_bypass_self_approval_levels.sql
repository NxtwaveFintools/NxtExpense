BEGIN;

create or replace function public.resolve_next_approval_level(
  p_owner public.employees,
  p_current_level int,
  p_mode public.claim_next_level_mode
)
returns int
language plpgsql
stable
set search_path = public
as $$
declare
  v_level int;
  v_owner_email text := lower(nullif(trim(coalesce(p_owner.employee_email, '')), ''));

  v_level_1_email text := lower(nullif(trim(coalesce(p_owner.approval_email_level_1, '')), ''));
  v_level_2_email text := lower(nullif(trim(coalesce(p_owner.approval_email_level_2, '')), ''));
  v_level_3_email text := lower(nullif(trim(coalesce(p_owner.approval_email_level_3, '')), ''));

  v_level_1_valid boolean := v_level_1_email is not null and v_level_1_email <> v_owner_email;
  v_level_2_valid boolean := v_level_2_email is not null and v_level_2_email <> v_owner_email;
  v_level_3_valid boolean := v_level_3_email is not null and v_level_3_email <> v_owner_email;
begin
  if p_mode = 'clear' then
    return null;
  end if;

  if p_mode = 'retain' then
    return p_current_level;
  end if;

  if p_mode = 'reset_first_configured' then
    if v_level_1_valid then
      return 1;
    end if;
    if v_level_2_valid then
      return 2;
    end if;
    if v_level_3_valid then
      return 3;
    end if;
    return null;
  end if;

  if p_current_level is null then
    return null;
  end if;

  v_level := null;

  if p_current_level < 2 and v_level_2_valid then
    v_level := 2;
  elsif p_current_level < 3 and v_level_3_valid then
    v_level := 3;
  end if;

  return v_level;
end;
$$;

drop table if exists pg_temp.self_assigned_claim_backfill;

create temporary table self_assigned_claim_backfill on commit drop as
with self_assigned_claims as (
  select
    c.id as claim_id,
    c.status as from_status,
    c.current_approval_level as from_level,
    public.resolve_next_approval_level(
      e,
      c.current_approval_level,
      'next_configured'::public.claim_next_level_mode
    ) as to_level
  from public.expense_claims c
  join public.employees e on e.id = c.employee_id
  where c.status = 'pending_approval'::public.claim_status
    and c.current_approval_level is not null
    and (
      (c.current_approval_level = 1 and lower(coalesce(e.approval_email_level_1, '')) = lower(coalesce(e.employee_email, '')))
      or (c.current_approval_level = 2 and lower(coalesce(e.approval_email_level_2, '')) = lower(coalesce(e.employee_email, '')))
      or (c.current_approval_level = 3 and lower(coalesce(e.approval_email_level_3, '')) = lower(coalesce(e.employee_email, '')))
    )
),
updated_claims as (
  update public.expense_claims c
  set
    status = case
      when s.to_level is null then 'finance_review'::public.claim_status
      else 'pending_approval'::public.claim_status
    end,
    current_approval_level = s.to_level,
    updated_at = now()
  from self_assigned_claims s
  where c.id = s.claim_id
  returning
    c.id as claim_id,
    s.from_status,
    s.from_level,
    c.status as to_status,
    c.current_approval_level as to_level
)
select *
from updated_claims;

insert into public.claim_status_audit (
  claim_id,
  actor_email,
  actor_scope,
  trigger_action,
  from_status,
  to_status,
  from_approval_level,
  to_approval_level,
  allow_resubmit,
  notes,
  metadata,
  changed_at
)
select
  u.claim_id,
  'system@nxt-expense.internal',
  'admin'::public.claim_actor_scope,
  'admin_override',
  u.from_status,
  u.to_status,
  u.from_level,
  u.to_level,
  null,
  'Auto-bypassed self-assigned approver level to continue workflow.',
  jsonb_build_object(
    'operation', 'self_approval_bypass_backfill',
    'from_level', u.from_level,
    'to_level', u.to_level
  ),
  now()
from self_assigned_claim_backfill u;

insert into public.approval_history (
  claim_id,
  approver_email,
  approval_level,
  action,
  notes,
  reason,
  metadata,
  acted_at
)
select
  u.claim_id,
  'system@nxt-expense.internal',
  null,
  'admin_override',
  'Auto-bypassed self-assigned approver level to continue workflow.',
  'Auto-bypassed self-assigned approver level to continue workflow.',
  jsonb_build_object(
    'operation', 'self_approval_bypass_backfill',
    'from_level', u.from_level,
    'to_level', u.to_level,
    'to_status', u.to_status
  ),
  now()
from self_assigned_claim_backfill u;

drop table if exists pg_temp.self_assigned_claim_backfill;


COMMIT;
