BEGIN;

-- Migration 127: Refactor RPCs to use role-based access checks (Part 2)
-- Phase 7 of ID-based architecture migration
--
-- Replaces designation::text = 'Finance' with employee_roles/roles join
-- Fixes get_filtered_approval_history actor filters to use designation_id/roles
-- Functions: submit_finance_action_atomic,
--            bulk_issue_claims_atomic,
--            get_filtered_approval_history

-- =============================================================================
-- 1. submit_finance_action_atomic
-- =============================================================================
CREATE OR REPLACE FUNCTION public.submit_finance_action_atomic(
  p_claim_id uuid,
  p_action finance_action_type,
  p_notes text DEFAULT NULL::text,
  p_allow_resubmit boolean DEFAULT false
)
RETURNS TABLE(claim_id uuid, updated_status claim_status)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_email text;
  v_notes text;
  v_claim public.expense_claims%rowtype;
  v_owner public.employees%rowtype;
  v_transition public.claim_transition_graph%rowtype;
  v_next_level int;
  v_next_status public.claim_status;
  v_is_finance boolean;
  v_history_action public.approval_action_type;
begin
  v_email := public.current_user_email();
  if coalesce(v_email, '') = '' then
    raise exception 'Unauthorized request.';
  end if;

  if p_action::text not in ('issued', 'finance_rejected', 'reopened') then
    raise exception 'Unsupported finance action.';
  end if;

  v_notes := nullif(trim(coalesce(p_notes, '')), '');

  -- Role-based finance check (replaces designation::text = 'Finance')
  select exists (
    select 1
    from public.employees e
    join public.employee_roles er on er.employee_id = e.id and er.is_active = true
    join public.roles r on r.id = er.role_id
    where lower(e.employee_email) = v_email
      and r.role_code in ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR')
  )
  into v_is_finance;

  if not v_is_finance then
    raise exception 'Finance access is required.';
  end if;

  select *
  into v_claim
  from public.expense_claims
  where id = p_claim_id
  for update;

  if not found then
    raise exception 'Claim not found.';
  end if;

  select *
  into v_owner
  from public.employees
  where id = v_claim.employee_id;

  select *
  into v_transition
  from public.claim_transition_graph t
  where t.tenant_id = v_claim.tenant_id
    and t.from_status = v_claim.status
    and t.trigger_action = p_action::text
    and t.actor_scope = 'finance'
    and t.is_active = true
    and (
      p_action::text <> 'finance_rejected'
      or t.allow_resubmit is null
      or t.allow_resubmit = p_allow_resubmit
    )
  order by t.created_at desc
  limit 1;

  if not found then
    raise exception 'No transition configured for this finance action.';
  end if;

  if v_transition.require_notes and v_notes is null then
    raise exception 'Notes are required for this action.';
  end if;

  v_next_level := public.resolve_next_approval_level(
    v_owner,
    v_claim.current_approval_level,
    v_transition.next_level_mode
  );

  v_next_status := v_transition.to_status;
  if v_next_level is null and v_transition.to_status_when_no_next is not null then
    v_next_status := v_transition.to_status_when_no_next;
  end if;

  update public.expense_claims
  set status = v_next_status,
      current_approval_level = v_next_level,
      last_rejection_notes = case when p_action::text = 'finance_rejected' then v_notes else last_rejection_notes end,
      last_rejected_by_email = case when p_action::text = 'finance_rejected' then v_email else last_rejected_by_email end,
      last_rejected_at = case when p_action::text = 'finance_rejected' then now() else last_rejected_at end,
      updated_at = now()
  where id = v_claim.id;

  insert into public.finance_actions (
    claim_id,
    actor_email,
    action,
    notes
  )
  values (
    v_claim.id,
    v_email,
    p_action,
    v_notes
  );

  v_history_action := case
    when p_action::text = 'issued' then 'finance_issued'::public.approval_action_type
    when p_action::text = 'reopened' then 'reopened'::public.approval_action_type
    else 'finance_rejected'::public.approval_action_type
  end;

  insert into public.approval_history (
    claim_id,
    approver_email,
    approval_level,
    action,
    notes,
    rejection_notes,
    allow_resubmit,
    metadata
  )
  values (
    v_claim.id,
    v_email,
    null,
    v_history_action,
    v_notes,
    case when p_action::text = 'finance_rejected' then v_notes else null end,
    case when p_action::text = 'finance_rejected' then p_allow_resubmit else null end,
    jsonb_build_object('transition_id', v_transition.id)
  );

  perform public.log_claim_status_audit(
    v_claim.id,
    v_email,
    'finance',
    p_action::text,
    v_claim.status,
    v_next_status,
    v_claim.current_approval_level,
    v_next_level,
    case when p_action::text = 'finance_rejected' then p_allow_resubmit else null end,
    v_notes,
    jsonb_build_object('transition_id', v_transition.id)
  );

  return query
  select v_claim.id, v_next_status;
end;
$function$;

-- =============================================================================
-- 2. bulk_issue_claims_atomic
-- =============================================================================
CREATE OR REPLACE FUNCTION public.bulk_issue_claims_atomic(
  p_claim_ids uuid[],
  p_notes text DEFAULT NULL::text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_email text;
  v_is_finance boolean;
  v_requested_count int;
  v_eligible_count int;
  v_updated_count int;
begin
  v_email := public.current_user_email();

  if coalesce(v_email, '') = '' then
    raise exception 'Unauthorized request.';
  end if;

  -- Role-based finance check (replaces designation::text = 'Finance')
  select exists (
    select 1
    from public.employees e
    join public.employee_roles er on er.employee_id = e.id and er.is_active = true
    join public.roles r on r.id = er.role_id
    where lower(e.employee_email) = v_email
      and r.role_code in ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR')
  )
  into v_is_finance;

  if not v_is_finance then
    raise exception 'Finance access is required.';
  end if;

  if p_claim_ids is null or coalesce(array_length(p_claim_ids, 1), 0) = 0 then
    raise exception 'At least one claim must be selected.';
  end if;

  with requested as (
    select distinct unnest(p_claim_ids) as claim_id
  )
  select count(*) into v_requested_count from requested;

  with requested as (
    select distinct unnest(p_claim_ids) as claim_id
  ),
  eligible as (
    select c.id
    from public.expense_claims c
    join requested r on r.claim_id = c.id
    where c.status = 'finance_review'
    for update
  )
  select count(*) into v_eligible_count from eligible;

  if v_eligible_count <> v_requested_count then
    raise exception 'One or more selected claims are not available in finance review.';
  end if;

  with requested as (
    select distinct unnest(p_claim_ids) as claim_id
  )
  insert into public.finance_actions (
    claim_id,
    actor_email,
    action,
    notes
  )
  select
    r.claim_id,
    v_email,
    'issued'::public.finance_action_type,
    nullif(trim(coalesce(p_notes, '')), '')
  from requested r;

  with requested as (
    select distinct unnest(p_claim_ids) as claim_id
  )
  update public.expense_claims c
  set status = 'issued'::public.claim_status,
      current_approval_level = null,
      updated_at = now()
  from requested r
  where c.id = r.claim_id;

  get diagnostics v_updated_count = row_count;

  return v_updated_count;
end;
$function$;

-- =============================================================================
-- 3. get_filtered_approval_history
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_filtered_approval_history(
  p_limit integer DEFAULT 10,
  p_cursor_acted_at timestamp with time zone DEFAULT NULL,
  p_cursor_action_id uuid DEFAULT NULL,
  p_name_search text DEFAULT NULL,
  p_actor_filters text[] DEFAULT NULL,
  p_claim_date_from date DEFAULT NULL,
  p_claim_date_to date DEFAULT NULL,
  p_hod_approved_from timestamp with time zone DEFAULT NULL,
  p_hod_approved_to timestamp with time zone DEFAULT NULL,
  p_finance_approved_from timestamp with time zone DEFAULT NULL,
  p_finance_approved_to timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  action_id uuid,
  claim_id uuid,
  claim_number text,
  claim_date date,
  work_location work_location_type,
  total_amount numeric,
  claim_status claim_status,
  owner_name text,
  owner_designation designation_type,
  actor_email text,
  actor_designation designation_type,
  action approval_action_type,
  approval_level integer,
  notes text,
  acted_at timestamp with time zone,
  hod_approved_at timestamp with time zone,
  finance_approved_at timestamp with time zone
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  select
    ah.id as action_id,
    ah.claim_id,
    c.claim_number,
    c.claim_date,
    c.work_location,
    c.total_amount,
    c.status as claim_status,
    owner_emp.employee_name as owner_name,
    owner_emp.designation as owner_designation,
    lower(ah.approver_email) as actor_email,
    actor_emp.designation as actor_designation,
    ah.action,
    ah.approval_level,
    ah.notes,
    ah.acted_at,
    hod_event.hod_approved_at,
    finance_event.finance_approved_at
  from public.approval_history ah
  join public.expense_claims c
    on c.id = ah.claim_id
  join public.employees owner_emp
    on owner_emp.id = c.employee_id
  left join public.employees actor_emp
    on lower(actor_emp.employee_email) = lower(ah.approver_email)
  left join lateral (
    select a.changed_at as hod_approved_at
    from public.claim_status_audit a
    where a.claim_id = c.id
      and a.actor_scope = 'approver'
      and a.trigger_action = 'approved'
      and a.to_status = 'finance_review'
    order by a.changed_at desc
    limit 1
  ) hod_event on true
  left join lateral (
    select a.changed_at as finance_approved_at
    from public.claim_status_audit a
    where a.claim_id = c.id
      and a.actor_scope = 'finance'
      and a.trigger_action = 'issued'
    order by a.changed_at desc
    limit 1
  ) finance_event on true
  where (
      p_name_search is null
      or trim(p_name_search) = ''
      or owner_emp.employee_name ilike ('%' || trim(p_name_search) || '%')
    )
    and (p_claim_date_from is null or c.claim_date >= p_claim_date_from)
    and (p_claim_date_to is null or c.claim_date <= p_claim_date_to)
    and (
      p_hod_approved_from is null
      or hod_event.hod_approved_at >= p_hod_approved_from
    )
    and (
      p_hod_approved_to is null
      or hod_event.hod_approved_at <= p_hod_approved_to
    )
    and (
      p_finance_approved_from is null
      or finance_event.finance_approved_at >= p_finance_approved_from
    )
    and (
      p_finance_approved_to is null
      or finance_event.finance_approved_at <= p_finance_approved_to
    )
    and (
      p_actor_filters is null
      or cardinality(p_actor_filters) = 0
      or 'all' = any(p_actor_filters)
      or (
        ('sbh' = any(p_actor_filters)
          and actor_emp.designation_id = public.get_designation_id('SBH'))
        or (
          'finance' = any(p_actor_filters)
          and exists (
            select 1
            from public.employee_roles er
            join public.roles r on r.id = er.role_id
            where er.employee_id = actor_emp.id
              and er.is_active = true
              and r.role_code in ('FINANCE_REVIEWER', 'FINANCE_PROCESSOR')
          )
        )
        or (
          'hod' = any(p_actor_filters)
          and exists (
            select 1
            from public.claim_status_audit hod_audit
            where hod_audit.claim_id = ah.claim_id
              and lower(hod_audit.actor_email) = lower(ah.approver_email)
              and hod_audit.actor_scope = 'approver'
              and hod_audit.trigger_action = 'approved'
              and hod_audit.to_status = 'finance_review'
          )
        )
      )
    )
    and (
      p_cursor_acted_at is null
      or p_cursor_action_id is null
      or ah.acted_at < p_cursor_acted_at
      or (
        ah.acted_at = p_cursor_acted_at
        and ah.id < p_cursor_action_id
      )
    )
  order by ah.acted_at desc, ah.id desc
  limit greatest(coalesce(p_limit, 10), 1) + 1;
$function$;

COMMIT;
