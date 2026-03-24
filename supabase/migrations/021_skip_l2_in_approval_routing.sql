BEGIN;

-- Migration 021: Fix approval routing to skip L2 (ZBH level) entirely
--
-- Business rule correction:
--   SRO / BOA / ABH → L1 (SBH) → L3 (Mansoor)        [2 levels]
--   SBH / ZBH / PM  → L3 (Mansoor) directly           [1 level]
--
-- L2 in the employees table is an org-chart field for the Zonal Business Head
-- relationship. It is NOT a stop in the expense claim approval flow.
--
-- The previous implementation routed next_configured mode as L1→L2→L3 and
-- reset_first_configured mode fell through to L2 when L1 was null.
-- Both are fixed here by removing all L2 routing logic.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1.  Replace resolve_next_approval_level — remove all L2 routing
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.resolve_next_approval_level(
  p_owner        public.employees,
  p_current_level int,
  p_mode         public.claim_next_level_mode
)
returns int
language plpgsql
stable
set search_path = public
as $$
declare
  v_level        int;
  v_owner_email  text := lower(nullif(trim(coalesce(p_owner.employee_email, '')), ''));

  v_level_1_email text := lower(nullif(trim(coalesce(p_owner.approval_email_level_1, '')), ''));
  v_level_3_email text := lower(nullif(trim(coalesce(p_owner.approval_email_level_3, '')), ''));

  -- L2 is intentionally not resolved — it is org hierarchy, not an approval stop
  v_level_1_valid boolean := v_level_1_email is not null and v_level_1_email <> v_owner_email;
  v_level_3_valid boolean := v_level_3_email is not null and v_level_3_email <> v_owner_email;
begin
  if p_mode = 'clear' then
    return null;
  end if;

  if p_mode = 'retain' then
    return p_current_level;
  end if;

  -- Initial submission or resubmission after rejection:
  -- Find the first active approval stop (L1 or L3 — L2 is skipped).
  if p_mode = 'reset_first_configured' then
    if v_level_1_valid then
      return 1;
    end if;
    -- L2 intentionally skipped per business rules
    if v_level_3_valid then
      return 3;
    end if;
    return null;
  end if;

  -- next_configured mode: advance from current level to the next stop.
  -- L1 → L3 directly (L2 is skipped).
  if p_current_level is null then
    return null;
  end if;

  v_level := null;

  if p_current_level < 3 and v_level_3_valid then
    v_level := 3;
  end if;

  return v_level;
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2.  Backfill in-flight claims stuck at L2 (harisanthosh)
--     They should be at L3 (mansoor) per the corrected business rules.
-- ─────────────────────────────────────────────────────────────────────────────
drop table if exists pg_temp.l2_bypass_backfill;

create temporary table l2_bypass_backfill on commit drop as
with stuck_claims as (
  select
    c.id                       as claim_id,
    c.status                   as from_status,
    c.current_approval_level   as from_level,
    3                          as to_level,
    'pending_approval'::public.claim_status as to_status,
    lower(coalesce(e.approval_email_level_2, 'system@nxt-expense.internal')) as bypassed_approver
  from public.expense_claims c
  join public.employees e on e.id = c.employee_id
  where c.status = 'pending_approval'::public.claim_status
    and c.current_approval_level = 2
    -- Only fix claims where L2 is a real (non-self, non-null) intermediate person
    and lower(coalesce(e.approval_email_level_2, '')) <> ''
    and lower(coalesce(e.approval_email_level_2, '')) <> lower(coalesce(e.employee_email, ''))
),
updated as (
  update public.expense_claims c
  set
    current_approval_level = s.to_level,
    updated_at             = now()
  from stuck_claims s
  where c.id = s.claim_id
  returning
    c.id                    as claim_id,
    s.from_status,
    s.from_level,
    s.to_status,
    c.current_approval_level as to_level,
    s.bypassed_approver
)
select * from updated;


-- Audit: claim_status_audit
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
  b.claim_id,
  'system@nxt-expense.internal',
  'admin'::public.claim_actor_scope,
  'admin_override',
  b.from_status,
  b.to_status,
  b.from_level,
  b.to_level,
  null,
  'L2 approval level bypassed — ZBH is not a stop in the expense claim flow per business rules.',
  jsonb_build_object(
    'operation',          'l2_bypass_backfill',
    'from_level',         b.from_level,
    'to_level',           b.to_level,
    'bypassed_approver',  b.bypassed_approver
  ),
  now()
from l2_bypass_backfill b;


-- Audit: approval_history (bypass_logged entry)
insert into public.approval_history (
  claim_id,
  approver_email,
  approval_level,
  action,
  notes,
  bypass_reason,
  skipped_levels,
  metadata,
  acted_at
)
select
  b.claim_id,
  'system@nxt-expense.internal',
  b.from_level,
  'bypass_logged'::public.approval_action_type,
  'L2 approval level bypassed — ZBH is not a stop in the expense claim flow per business rules.',
  'Business rule correction: L2 (Zonal Business Head) is org hierarchy only, not an expense approval stop.',
  jsonb_build_array(
    jsonb_build_object(
      'level',    b.from_level,
      'approver', b.bypassed_approver,
      'reason',   'L2 not part of expense approval flow'
    )
  ),
  jsonb_build_object(
    'operation',          'l2_bypass_backfill',
    'from_level',         b.from_level,
    'to_level',           b.to_level,
    'bypassed_approver',  b.bypassed_approver
  ),
  now()
from l2_bypass_backfill b;

drop table if exists pg_temp.l2_bypass_backfill;


COMMIT;
