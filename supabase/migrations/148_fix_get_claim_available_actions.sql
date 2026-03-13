-- Migration 148: Rewrite get_claim_available_actions to use new schema
-- FIXES: "record v_claim has no field status" error
-- The old function referenced:
--   v_claim.status (dropped → now status_id)
--   v_owner.approval_email_level_1/2/3 (dropped → now approval_employee_id_level_1/2/3)
--   claim_transition_graph (dropped → now claim_status_transitions)
--   FINANCE_REVIEWER/FINANCE_PROCESSOR (legacy → now FINANCE_TEAM)

CREATE OR REPLACE FUNCTION public.get_claim_available_actions(p_claim_id uuid)
RETURNS TABLE(action text, display_label text, require_notes boolean, supports_allow_resubmit boolean, actor_scope text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_email text;
  v_claim public.expense_claims%rowtype;
  v_claim_status_code text;
  v_owner public.employees%rowtype;
  v_current public.employees%rowtype;
  v_actor text;
  v_actor_role_codes text[];
begin
  v_email := public.current_user_email();
  if coalesce(v_email, '') = '' then return; end if;

  select * into v_claim from public.expense_claims where id = p_claim_id;
  if not found then return; end if;

  -- Resolve status code from the new status_id FK
  select cs.status_code into v_claim_status_code
  from public.claim_statuses cs where cs.id = v_claim.status_id;
  if v_claim_status_code is null then return; end if;

  select * into v_owner from public.employees where id = v_claim.employee_id;
  select * into v_current from public.employees where lower(employee_email) = v_email;
  if not found then return; end if;

  -- Determine actor scope using new ID-based columns
  if exists (
    select 1 from public.employee_roles er join public.roles r on r.id = er.role_id
    where er.employee_id = v_current.id and er.is_active = true and r.role_code = 'ADMIN'
  ) then v_actor := 'admin';
  elsif exists (
    select 1 from public.employee_roles er join public.roles r on r.id = er.role_id
    where er.employee_id = v_current.id and er.is_active = true and r.role_code = 'FINANCE_TEAM'
  ) then v_actor := 'finance';
  elsif v_current.id = v_claim.employee_id
    and v_claim_status_code = 'RETURNED_FOR_MODIFICATION'
  then v_actor := 'employee';
  elsif v_owner.approval_employee_id_level_1 = v_current.id
    and v_claim.current_approval_level = 1
  then v_actor := 'approver';
  elsif v_owner.approval_employee_id_level_3 = v_current.id
    and v_claim.current_approval_level = 2
  then v_actor := 'approver';
  else return;
  end if;

  -- Map actor scope to the role codes used in claim_status_transitions
  v_actor_role_codes := case v_actor
    when 'employee' then ARRAY['EMPLOYEE']
    when 'approver' then
      case v_claim.current_approval_level
        when 1 then ARRAY['APPROVER_L1']
        when 2 then ARRAY['APPROVER_L2']
        else ARRAY[]::text[]
      end
    when 'finance' then ARRAY['FINANCE_TEAM']
    when 'admin' then ARRAY['ADMIN', 'FINANCE_TEAM', 'APPROVER_L1', 'APPROVER_L2', 'EMPLOYEE']
    else ARRAY[]::text[]
  end;

  -- Query claim_status_transitions (replaces legacy claim_transition_graph)
  -- NOTE: action_code 'finance_issued' is mapped to 'issued' because
  -- submit_finance_action_atomic expects p_action = 'issued' as its external API.
  return query
  select
    case t.action_code
      when 'finance_issued' then 'issued'
      else t.action_code
    end,
    case t.action_code
      when 'approved'         then 'Approve'
      when 'rejected'         then 'Reject'
      when 'submit'           then 'Submit'
      when 'resubmit'         then 'Resubmit'
      when 'finance_issued'   then 'Issue Payment'
      when 'finance_rejected' then 'Reject'
      when 'reopened'         then 'Reopen'
      else initcap(replace(t.action_code, '_', ' '))
    end as display_label,
    bool_or(t.requires_comment) as require_notes,
    bool_or(coalesce(t.allow_resubmit, false)) as supports_allow_resubmit,
    v_actor
  from public.claim_status_transitions t
  left join public.roles r on r.id = t.requires_role_id
  where t.from_status_id = v_claim.status_id
    and t.is_active = true
    and t.is_auto_transition = false
    and (
      t.requires_role_id is null
      or r.role_code = any(v_actor_role_codes)
    )
  group by t.action_code
  order by min(t.created_at);
end;
$function$;
