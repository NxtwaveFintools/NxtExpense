BEGIN;

-- Update workflow action resolver so employee actions are no longer tied
-- to the removed RETURNED_FOR_MODIFICATION state.
CREATE OR REPLACE FUNCTION public.get_claim_available_actions(p_claim_id uuid)
RETURNS TABLE(
  action text,
  display_label text,
  require_notes boolean,
  supports_allow_resubmit boolean,
  actor_scope text
)
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

  select cs.status_code into v_claim_status_code
  from public.claim_statuses cs
  where cs.id = v_claim.status_id;
  if v_claim_status_code is null then return; end if;

  select * into v_owner from public.employees where id = v_claim.employee_id;
  select * into v_current from public.employees where lower(employee_email) = v_email;
  if not found then return; end if;

  if exists (
    select 1
    from public.employee_roles er
    join public.roles r on r.id = er.role_id
    where er.employee_id = v_current.id
      and er.is_active = true
      and r.role_code = 'ADMIN'
  ) then
    v_actor := 'admin';
  elsif exists (
    select 1
    from public.employee_roles er
    join public.roles r on r.id = er.role_id
    where er.employee_id = v_current.id
      and er.is_active = true
      and r.role_code = 'FINANCE_TEAM'
  ) then
    v_actor := 'finance';
  elsif v_owner.approval_employee_id_level_1 = v_current.id
    and v_claim.current_approval_level = 1
  then
    v_actor := 'approver';
  elsif v_owner.approval_employee_id_level_3 = v_current.id
    and v_claim.current_approval_level = 2
  then
    v_actor := 'approver';
  else
    return;
  end if;

  v_actor_role_codes := case v_actor
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

-- Keep RPC available for backward compatibility, but remove legacy status
-- dependencies. Claims now enter workflow directly in pending status.
CREATE OR REPLACE FUNCTION public.resubmit_claim_after_rejection_atomic(
  p_claim_id uuid,
  p_notes text DEFAULT NULL::text
)
RETURNS TABLE(claim_id uuid, new_status_code text, new_approval_level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_email text;
  v_claim public.expense_claims%rowtype;
  v_status_code text;
begin
  v_email := public.current_user_email();
  if coalesce(v_email, '') = '' then
    raise exception 'Unauthorized request.';
  end if;

  select c.* into v_claim
  from public.expense_claims c
  join public.employees e on e.id = c.employee_id
  where c.id = p_claim_id
    and lower(e.employee_email) = v_email
  for update;

  if not found then
    raise exception 'Claim not found for current employee.';
  end if;

  select cs.status_code into v_status_code
  from public.claim_statuses cs
  where cs.id = v_claim.status_id;

  if v_status_code not in ('L1_PENDING', 'L2_PENDING', 'L3_PENDING_FINANCE_REVIEW') then
    raise exception 'Claim is not in an active workflow state.';
  end if;

  return query
  select v_claim.id, v_status_code, v_claim.current_approval_level;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_reassign_employee_approvers_atomic(
  p_employee_id uuid,
  p_level_1 text DEFAULT NULL::text,
  p_level_2 text DEFAULT NULL::text,
  p_level_3 text DEFAULT NULL::text,
  p_reason text DEFAULT NULL::text,
  p_confirmation text DEFAULT NULL::text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_email               text;
  v_admin_employee_id   uuid;
  v_reason              text;
  v_l1_email            text;
  v_l2_email            text;
  v_l3_email            text;
  v_l1_id               uuid;
  v_l2_id               uuid;
  v_l3_id               uuid;
  v_claim_count         int;
BEGIN
  v_email  := public.current_user_email();
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  IF coalesce(v_email, '') = ''  THEN RAISE EXCEPTION 'Unauthorized request.'; END IF;
  IF p_confirmation <> 'CONFIRM' THEN RAISE EXCEPTION 'Secondary confirmation is required.'; END IF;
  IF v_reason IS NULL            THEN RAISE EXCEPTION 'Reassignment reason is required.'; END IF;

  SELECT e.id INTO v_admin_employee_id
  FROM public.employees e
  JOIN public.employee_roles er ON er.employee_id = e.id AND er.is_active = true
  JOIN public.roles r ON r.id = er.role_id
  WHERE lower(e.employee_email) = v_email AND r.role_code = 'ADMIN'
  LIMIT 1;
  IF v_admin_employee_id IS NULL THEN RAISE EXCEPTION 'Admin access is required.'; END IF;

  v_l1_email := nullif(lower(trim(coalesce(p_level_1, ''))), '');
  v_l2_email := nullif(lower(trim(coalesce(p_level_2, ''))), '');
  v_l3_email := nullif(lower(trim(coalesce(p_level_3, ''))), '');

  IF v_l1_email IS NOT NULL THEN
    SELECT id INTO v_l1_id FROM public.employees WHERE lower(employee_email) = v_l1_email;
    IF v_l1_id IS NULL THEN RAISE EXCEPTION 'Level 1 approver email not found: %', v_l1_email; END IF;
  END IF;
  IF v_l2_email IS NOT NULL THEN
    SELECT id INTO v_l2_id FROM public.employees WHERE lower(employee_email) = v_l2_email;
    IF v_l2_id IS NULL THEN RAISE EXCEPTION 'Level 2 approver email not found: %', v_l2_email; END IF;
  END IF;
  IF v_l3_email IS NOT NULL THEN
    SELECT id INTO v_l3_id FROM public.employees WHERE lower(employee_email) = v_l3_email;
    IF v_l3_id IS NULL THEN RAISE EXCEPTION 'Level 3 approver email not found: %', v_l3_email; END IF;
  END IF;

  UPDATE public.employees
  SET approval_employee_id_level_1 = v_l1_id,
      approval_employee_id_level_2 = v_l2_id,
      approval_employee_id_level_3 = v_l3_id
  WHERE id = p_employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found for approver reassignment.'; END IF;

  INSERT INTO public.approval_history (
    claim_id, approver_employee_id, approval_level, action, notes, reason, metadata
  )
  SELECT c.id, v_admin_employee_id, null, 'admin_override', v_reason, v_reason,
    jsonb_build_object(
      'operation',   'reassign_approvers',
      'employee_id', p_employee_id,
      'level_1_email', v_l1_email,
      'level_2_email', v_l2_email,
      'level_3_email', v_l3_email
    )
  FROM public.expense_claims c
  WHERE c.employee_id = p_employee_id
    AND c.status_id IN (
      SELECT id
      FROM public.claim_statuses
      WHERE status_code IN ('L1_PENDING', 'L2_PENDING', 'L3_PENDING_FINANCE_REVIEW')
    );

  GET DIAGNOSTICS v_claim_count = ROW_COUNT;
  RETURN v_claim_count;
END;
$function$;

COMMIT;
