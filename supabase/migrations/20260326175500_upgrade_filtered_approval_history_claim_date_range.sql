BEGIN;

DROP FUNCTION IF EXISTS public.get_filtered_approval_history(
  integer,
  timestamptz,
  uuid,
  text,
  text[],
  text,
  uuid,
  date,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz
);

DROP FUNCTION IF EXISTS public.get_filtered_approval_history(
  integer,
  timestamptz,
  uuid,
  text,
  text[],
  text,
  uuid,
  text,
  numeric,
  text,
  date,
  date,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz
);

CREATE FUNCTION public.get_filtered_approval_history(
  p_limit integer DEFAULT 10,
  p_cursor_acted_at timestamptz DEFAULT NULL,
  p_cursor_action_id uuid DEFAULT NULL,
  p_name_search text DEFAULT NULL,
  p_actor_filters text[] DEFAULT NULL,
  p_claim_status text DEFAULT NULL,
  p_claim_status_id uuid DEFAULT NULL,
  p_amount_operator text DEFAULT 'lte',
  p_amount_value numeric DEFAULT NULL,
  p_location_type text DEFAULT NULL,
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
  claim_status_name text,
  claim_status_display_color text,
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
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  with me as (
    select e.id as employee_id
    from public.employees e
    where lower(e.employee_email) = current_user_email()
    limit 1
  ),
  payment_issued_actions as (
    select distinct
      case
        when coalesce(to_status.is_payment_issued, false) = true
          and cst.action_code like 'finance_%'
          then substr(cst.action_code, length('finance_') + 1)
        else cst.action_code
      end as action_code
    from public.claim_status_transitions cst
    join public.claim_statuses to_status on to_status.id = cst.to_status_id
    where cst.is_active = true
      and to_status.is_active = true
      and coalesce(to_status.is_payment_issued, false) = true
  ),
  latest_actions as (
    select distinct on (ah.claim_id)
      ah.id as action_id,
      ah.claim_id,
      ah.approver_employee_id,
      ah.action,
      ah.approval_level,
      ah.notes,
      ah.acted_at
    from public.approval_history ah
    order by ah.claim_id, ah.acted_at desc, ah.id desc
  )
  select
    la.action_id,
    la.claim_id,
    c.claim_number,
    c.claim_date,
    wl.location_name as work_location,
    c.total_amount,
    cs.status_code as claim_status,
    cs.status_name as claim_status_name,
    cs.display_color as claim_status_display_color,
    owner_emp.employee_name as owner_name,
    owner_desig.designation_name as owner_designation,
    actor_emp.employee_email as actor_email,
    actor_desig.designation_name as actor_designation,
    la.action,
    la.approval_level,
    la.notes,
    la.acted_at,
    hod_event.hod_approved_at,
    finance_event.finance_approved_at
  from latest_actions la
  join public.expense_claims c on c.id = la.claim_id
  join public.claim_statuses cs on cs.id = c.status_id
  join public.employees owner_emp on owner_emp.id = c.employee_id
  left join public.work_locations wl on wl.id = c.work_location_id
  left join public.designations owner_desig on owner_desig.id = owner_emp.designation_id
  left join public.employees actor_emp on actor_emp.id = la.approver_employee_id
  left join public.designations actor_desig on actor_desig.id = actor_emp.designation_id
  left join lateral (
    select ah_hod.acted_at as hod_approved_at
    from public.approval_history ah_hod
    join public.claim_statuses to_status on to_status.id = ah_hod.new_status_id
    where ah_hod.claim_id = c.id
      and to_status.approval_level = 3
      and to_status.is_approval = false
      and to_status.is_rejection = false
      and to_status.is_terminal = false
    order by ah_hod.acted_at desc
    limit 1
  ) hod_event on true
  left join lateral (
    select fa.acted_at as finance_approved_at
    from public.finance_actions fa
    where fa.claim_id = c.id
      and exists (
        select 1
        from payment_issued_actions pia
        where pia.action_code = case
          when fa.action like 'finance_%' then substr(fa.action, length('finance_') + 1)
          else fa.action
        end
      )
    order by fa.acted_at desc
    limit 1
  ) finance_event on true
  where
    (
      c.employee_id in (select employee_id from me)
      or exists (
        select 1
        from public.approval_history ah_actor
        where ah_actor.claim_id = c.id
          and ah_actor.approver_employee_id in (select employee_id from me)
      )
      or exists (
        select 1
        from public.employees adm
        join public.employee_roles er on er.employee_id = adm.id and er.is_active = true
        join public.roles r on r.id = er.role_id
        where lower(adm.employee_email) = current_user_email()
          and r.is_admin_role = true
      )
    )
    and (
      p_name_search is null
      or trim(p_name_search) = ''
      or owner_emp.employee_name ilike ('%' || trim(p_name_search) || '%')
    )
    and (
      p_claim_status_id is null
      or cs.id = p_claim_status_id
    )
    and (
      p_claim_status is null
      or trim(p_claim_status) = ''
      or cs.status_code = trim(p_claim_status)
    )
    and (
      p_amount_value is null
      or (
        coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'gte'
        and c.total_amount >= p_amount_value
      )
      or (
        coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'eq'
        and c.total_amount = p_amount_value
      )
      or (
        coalesce(nullif(trim(lower(p_amount_operator)), ''), 'lte') = 'lte'
        and c.total_amount <= p_amount_value
      )
    )
    and (
      p_location_type is null
      or trim(p_location_type) = ''
      or (
        lower(trim(p_location_type)) = 'outstation'
        and exists (
          select 1
          from public.work_locations wlo
          where wlo.id = c.work_location_id
            and wlo.requires_outstation_details = true
        )
      )
      or (
        lower(trim(p_location_type)) = 'base'
        and exists (
          select 1
          from public.work_locations wlb
          where wlb.id = c.work_location_id
            and wlb.requires_outstation_details = false
            and wlb.requires_vehicle_selection = true
            and wlb.allows_expenses = true
        )
      )
    )
    and (
      p_claim_date_from is null
      or c.claim_date >= p_claim_date_from
    )
    and (
      p_claim_date_to is null
      or c.claim_date <= p_claim_date_to
    )
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
      p_cursor_acted_at is null
      or p_cursor_action_id is null
      or la.acted_at < p_cursor_acted_at
      or (la.acted_at = p_cursor_acted_at and la.action_id < p_cursor_action_id)
    )
  order by la.acted_at desc, la.action_id desc
  limit greatest(coalesce(p_limit, 10), 1) + 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_filtered_approval_history(
  integer,
  timestamptz,
  uuid,
  text,
  text[],
  text,
  uuid,
  text,
  numeric,
  text,
  date,
  date,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz
) TO authenticated;

COMMIT;
