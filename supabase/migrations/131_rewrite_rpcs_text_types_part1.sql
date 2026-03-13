-- Migration 131: Rewrite RPCs to use text types instead of enum types (Part 1)
-- Phase 9b — prerequisite functions + read RPCs
--
-- Functions updated: log_claim_status_audit, resolve_next_approval_level,
--   get_filtered_approval_history, get_claim_available_actions

BEGIN;

-- =============================================================================
-- 1. log_claim_status_audit — params used claim_actor_scope + claim_status
-- =============================================================================
DROP FUNCTION IF EXISTS public.log_claim_status_audit(uuid, text, claim_actor_scope, text, claim_status, claim_status, integer, integer, boolean, text, jsonb);

CREATE OR REPLACE FUNCTION public.log_claim_status_audit(
  p_claim_id uuid,
  p_actor_email text,
  p_actor_scope text,
  p_trigger_action text,
  p_from_status text,
  p_to_status text,
  p_from_approval_level integer,
  p_to_approval_level integer,
  p_allow_resubmit boolean,
  p_notes text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  insert into public.claim_status_audit (
    claim_id, actor_email, actor_scope, trigger_action,
    from_status, to_status, from_approval_level, to_approval_level,
    allow_resubmit, notes, metadata
  )
  values (
    p_claim_id, lower(p_actor_email), p_actor_scope, p_trigger_action,
    p_from_status, p_to_status, p_from_approval_level, p_to_approval_level,
    p_allow_resubmit, p_notes, coalesce(p_metadata, '{}'::jsonb)
  );
$function$;

-- =============================================================================
-- 2. resolve_next_approval_level — param used claim_next_level_mode
-- =============================================================================
DROP FUNCTION IF EXISTS public.resolve_next_approval_level(employees, integer, claim_next_level_mode);

CREATE OR REPLACE FUNCTION public.resolve_next_approval_level(
  p_owner public.employees,
  p_current_level integer,
  p_mode text
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
declare
  v_level        int;
  v_owner_email  text := lower(nullif(trim(coalesce(p_owner.employee_email, '')), ''));
  v_level_1_email text := lower(nullif(trim(coalesce(p_owner.approval_email_level_1, '')), ''));
  v_level_3_email text := lower(nullif(trim(coalesce(p_owner.approval_email_level_3, '')), ''));
  v_level_1_valid boolean := v_level_1_email is not null and v_level_1_email <> v_owner_email;
  v_level_3_valid boolean := v_level_3_email is not null and v_level_3_email <> v_owner_email;
begin
  if p_mode = 'clear' then return null; end if;
  if p_mode = 'retain' then return p_current_level; end if;

  if p_mode = 'reset_first_configured' then
    if v_level_1_valid then return 1; end if;
    if v_level_3_valid then return 3; end if;
    return null;
  end if;

  if p_current_level is null then return null; end if;
  v_level := null;
  if p_current_level < 3 and v_level_3_valid then v_level := 3; end if;
  return v_level;
end;
$function$;

-- =============================================================================
-- 3. get_filtered_approval_history — return type used 5 enum types
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_filtered_approval_history(integer, timestamptz, uuid, text, text[], date, date, timestamptz, timestamptz, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.get_filtered_approval_history(
  p_limit integer DEFAULT 10,
  p_cursor_acted_at timestamptz DEFAULT NULL,
  p_cursor_action_id uuid DEFAULT NULL,
  p_name_search text DEFAULT NULL,
  p_actor_filters text[] DEFAULT NULL,
  p_claim_date_from date DEFAULT NULL,
  p_claim_date_to date DEFAULT NULL,
  p_hod_approved_from timestamptz DEFAULT NULL,
  p_hod_approved_to timestamptz DEFAULT NULL,
  p_finance_approved_from timestamptz DEFAULT NULL,
  p_finance_approved_to timestamptz DEFAULT NULL
)
RETURNS TABLE(
  action_id uuid,
  claim_id uuid,
  claim_number text,
  claim_date date,
  work_location text,
  total_amount numeric,
  claim_status text,
  owner_name text,
  owner_designation text,
  actor_email text,
  actor_designation text,
  action text,
  approval_level integer,
  notes text,
  acted_at timestamptz,
  hod_approved_at timestamptz,
  finance_approved_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  select
    ah.id as action_id, ah.claim_id, c.claim_number, c.claim_date,
    c.work_location, c.total_amount, c.status as claim_status,
    owner_emp.employee_name as owner_name,
    owner_emp.designation as owner_designation,
    lower(ah.approver_email) as actor_email,
    actor_emp.designation as actor_designation,
    ah.action, ah.approval_level, ah.notes, ah.acted_at,
    hod_event.hod_approved_at, finance_event.finance_approved_at
  from public.approval_history ah
  join public.expense_claims c on c.id = ah.claim_id
  join public.employees owner_emp on owner_emp.id = c.employee_id
  left join public.employees actor_emp
    on lower(actor_emp.employee_email) = lower(ah.approver_email)
  left join lateral (
    select a.changed_at as hod_approved_at
    from public.claim_status_audit a
    where a.claim_id = c.id
      and a.actor_scope = 'approver'
      and a.trigger_action = 'approved'
      and a.to_status = 'finance_review'
    order by a.changed_at desc limit 1
  ) hod_event on true
  left join lateral (
    select a.changed_at as finance_approved_at
    from public.claim_status_audit a
    where a.claim_id = c.id
      and a.actor_scope = 'finance'
      and a.trigger_action = 'issued'
    order by a.changed_at desc limit 1
  ) finance_event on true
  where
    (p_name_search is null or trim(p_name_search) = ''
      or owner_emp.employee_name ilike ('%' || trim(p_name_search) || '%'))
    and (p_claim_date_from is null or c.claim_date >= p_claim_date_from)
    and (p_claim_date_to is null or c.claim_date <= p_claim_date_to)
    and (p_hod_approved_from is null or hod_event.hod_approved_at >= p_hod_approved_from)
    and (p_hod_approved_to is null or hod_event.hod_approved_at <= p_hod_approved_to)
    and (p_finance_approved_from is null or finance_event.finance_approved_at >= p_finance_approved_from)
    and (p_finance_approved_to is null or finance_event.finance_approved_at <= p_finance_approved_to)
    and (
      p_actor_filters is null or cardinality(p_actor_filters) = 0
      or 'all' = any(p_actor_filters)
      or (
        ('sbh' = any(p_actor_filters)
          and actor_emp.designation_id = public.get_designation_id('SBH'))
        or ('finance' = any(p_actor_filters) and exists (
          select 1 from public.employee_roles er
          join public.roles r on r.id = er.role_id
          where er.employee_id = actor_emp.id and er.is_active = true
            and r.role_code in ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR')))
        or ('hod' = any(p_actor_filters) and exists (
          select 1 from public.claim_status_audit hod_audit
          where hod_audit.claim_id = ah.claim_id
            and lower(hod_audit.actor_email) = lower(ah.approver_email)
            and hod_audit.actor_scope = 'approver'
            and hod_audit.trigger_action = 'approved'
            and hod_audit.to_status = 'finance_review'))
      )
    )
    and (
      p_cursor_acted_at is null or p_cursor_action_id is null
      or ah.acted_at < p_cursor_acted_at
      or (ah.acted_at = p_cursor_acted_at and ah.id < p_cursor_action_id)
    )
  order by ah.acted_at desc, ah.id desc
  limit greatest(coalesce(p_limit, 10), 1) + 1;
$function$;

-- =============================================================================
-- 4. get_claim_available_actions — return type used claim_actor_scope
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_claim_available_actions(uuid);

CREATE OR REPLACE FUNCTION public.get_claim_available_actions(p_claim_id uuid)
RETURNS TABLE(action text, display_label text, require_notes boolean, supports_allow_resubmit boolean, actor_scope text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_email text;
  v_claim public.expense_claims%rowtype;
  v_owner public.employees%rowtype;
  v_current public.employees%rowtype;
  v_actor text;
  v_level int;
begin
  v_email := public.current_user_email();
  if coalesce(v_email, '') = '' then return; end if;

  select * into v_claim from public.expense_claims where id = p_claim_id;
  if not found then return; end if;

  select * into v_owner from public.employees where id = v_claim.employee_id;
  select * into v_current from public.employees where lower(employee_email) = v_email;

  if found and exists (
    select 1 from public.employee_roles er join public.roles r on r.id = er.role_id
    where er.employee_id = v_current.id and er.is_active = true and r.role_code = 'ADMIN'
  ) then v_actor := 'admin';
  elsif found and exists (
    select 1 from public.employee_roles er join public.roles r on r.id = er.role_id
    where er.employee_id = v_current.id and er.is_active = true
      and r.role_code in ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR')
  ) then v_actor := 'finance';
  elsif lower(coalesce(v_owner.employee_email, '')) = v_email
    and v_claim.status = 'returned_for_modification'
  then v_actor := 'employee';
  elsif lower(coalesce(v_owner.approval_email_level_1, '')) = v_email
    and v_claim.current_approval_level = 1
  then v_actor := 'approver'; v_level := 1;
  elsif lower(coalesce(v_owner.approval_email_level_2, '')) = v_email
    and v_claim.current_approval_level = 2
  then v_actor := 'approver'; v_level := 2;
  elsif lower(coalesce(v_owner.approval_email_level_3, '')) = v_email
    and v_claim.current_approval_level = 3
  then v_actor := 'approver'; v_level := 3;
  else return;
  end if;

  return query
  select t.trigger_action, max(t.action_label) as display_label,
    bool_or(t.require_notes) as require_notes,
    bool_or(t.allow_resubmit = true) as supports_allow_resubmit,
    v_actor
  from public.claim_transition_graph t
  where t.tenant_id = v_claim.tenant_id
    and t.from_status = v_claim.status
    and t.actor_scope = v_actor
    and t.is_active = true
    and (v_actor <> 'approver' or t.allowed_approver_levels is null
      or v_level = any(t.allowed_approver_levels))
  group by t.trigger_action
  order by min(t.created_at);
end;
$function$;

COMMIT;
