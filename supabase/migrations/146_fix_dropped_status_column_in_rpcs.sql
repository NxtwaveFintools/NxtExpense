-- Migration 146: Fix the 2 RPCs not fixed by migration 144.
--
-- 1. get_filtered_approval_history (from mig 136) — references c.status (dropped),
--    stale role codes FINANCE_REVIEWER/FINANCE_PROCESSOR, stale audit strings.
-- 2. submit_finance_action_atomic (mig 144 had issued_at bug) — column never existed.

BEGIN;

-- =============================================================================
-- Fix 1: submit_finance_action_atomic
-- Remove issued_at from UPDATE (column does not exist on expense_claims).
-- Return type TABLE(claim_id uuid, new_status_code text) is unchanged.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.submit_finance_action_atomic(
  p_claim_id       uuid,
  p_action         text,
  p_notes          text    DEFAULT NULL,
  p_allow_resubmit boolean DEFAULT NULL
)
RETURNS TABLE(claim_id uuid, new_status_code text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email                  text;
  v_actor_employee_id      uuid;
  v_notes                  text;
  v_claim                  public.expense_claims%rowtype;
  v_transition             public.claim_status_transitions%rowtype;
  v_next_status_code       text;
  v_next_status_id         uuid;
  v_old_status_id          uuid;
  v_action_code            text;
  v_history_action         text;
BEGIN
  IF p_action NOT IN ('issued', 'finance_rejected', 'reopened') THEN
    RAISE EXCEPTION 'Unsupported finance action.';
  END IF;

  v_email := public.current_user_email();
  IF coalesce(v_email, '') = '' THEN RAISE EXCEPTION 'Unauthorized request.'; END IF;
  v_notes := nullif(trim(coalesce(p_notes, '')), '');

  SELECT id INTO v_actor_employee_id FROM public.employees WHERE lower(employee_email) = v_email;

  IF NOT EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.employee_roles er ON er.employee_id = e.id AND er.is_active = true
    JOIN public.roles r ON r.id = er.role_id
    WHERE lower(e.employee_email) = v_email AND r.role_code = 'FINANCE_TEAM'
  ) THEN RAISE EXCEPTION 'Finance Team access is required.'; END IF;

  SELECT * INTO v_claim FROM public.expense_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found.'; END IF;

  v_action_code    := CASE p_action
    WHEN 'issued'           THEN 'finance_issued'
    WHEN 'reopened'         THEN 'reopened'
    ELSE 'finance_rejected'
  END;
  v_history_action := v_action_code;

  SELECT cst.* INTO v_transition
  FROM public.claim_status_transitions cst
  WHERE cst.from_status_id  = v_claim.status_id
    AND cst.is_active         = true
    AND cst.action_code       = v_action_code
    AND cst.requires_role_id  = (SELECT id FROM public.roles WHERE role_code = 'FINANCE_TEAM')
    AND cst.allow_resubmit    IS NOT DISTINCT FROM (
          CASE WHEN p_action = 'finance_rejected' THEN p_allow_resubmit ELSE NULL END
        )
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'No transition configured for this finance action.'; END IF;
  IF v_transition.requires_comment AND v_notes IS NULL THEN
    RAISE EXCEPTION 'Notes are required for this action.';
  END IF;

  SELECT status_code INTO v_next_status_code FROM public.claim_statuses WHERE id = v_transition.to_status_id;
  v_next_status_id := v_transition.to_status_id;
  v_old_status_id  := v_claim.status_id;

  -- issued_at removed: column does not exist on expense_claims
  UPDATE public.expense_claims
  SET status_id                    = v_next_status_id,
      current_approval_level       = NULL,
      last_rejection_notes         = CASE WHEN p_action = 'finance_rejected' THEN v_notes ELSE last_rejection_notes END,
      last_rejected_by_employee_id = CASE WHEN p_action = 'finance_rejected' THEN v_actor_employee_id ELSE last_rejected_by_employee_id END,
      last_rejected_at             = CASE WHEN p_action = 'finance_rejected' THEN now() ELSE last_rejected_at END,
      updated_at                   = now()
  WHERE id = v_claim.id;

  INSERT INTO public.finance_actions (claim_id, actor_employee_id, action, notes)
  VALUES (v_claim.id, v_actor_employee_id, p_action, v_notes);

  INSERT INTO public.approval_history (
    claim_id, approver_employee_id, approval_level, action, notes,
    rejection_notes, allow_resubmit, metadata, old_status_id, new_status_id
  ) VALUES (
    v_claim.id, v_actor_employee_id, null, v_history_action, v_notes,
    CASE WHEN p_action = 'finance_rejected' THEN v_notes ELSE null END,
    CASE WHEN p_action = 'finance_rejected' THEN p_allow_resubmit ELSE null END,
    jsonb_build_object('transition_id', v_transition.id),
    v_old_status_id, v_next_status_id
  );

  PERFORM public.log_claim_status_audit(
    v_claim.id, v_email, 'finance', v_action_code,
    v_next_status_code, v_next_status_code,
    null, NULL,
    CASE WHEN p_action = 'finance_rejected' THEN p_allow_resubmit ELSE null END,
    v_notes, jsonb_build_object('transition_id', v_transition.id)
  );

  RETURN QUERY SELECT v_claim.id, v_next_status_code;
END;
$$;

-- =============================================================================
-- Fix 2: get_filtered_approval_history
-- * c.status -> join claim_statuses cs, use cs.status_code
-- * FINANCE_REVIEWER / FINANCE_PROCESSOR -> FINANCE_TEAM
-- * hod_event to_status 'finance_review' -> 'L3_PENDING_FINANCE_REVIEW'
-- * finance_event trigger_action 'issued' -> 'finance_issued'
-- * hod filter to_status 'finance_review' -> 'L3_PENDING_FINANCE_REVIEW'
-- Return type is identical to the existing function: DROP required to replace.
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_filtered_approval_history(
  integer, timestamptz, uuid, text, text[], date, date,
  timestamptz, timestamptz, timestamptz, timestamptz
);

CREATE FUNCTION public.get_filtered_approval_history(
  p_limit                 integer                  DEFAULT 10,
  p_cursor_acted_at       timestamp with time zone DEFAULT NULL,
  p_cursor_action_id      uuid                     DEFAULT NULL,
  p_name_search           text                     DEFAULT NULL,
  p_actor_filters         text[]                   DEFAULT NULL,
  p_claim_date_from       date                     DEFAULT NULL,
  p_claim_date_to         date                     DEFAULT NULL,
  p_hod_approved_from     timestamp with time zone DEFAULT NULL,
  p_hod_approved_to       timestamp with time zone DEFAULT NULL,
  p_finance_approved_from timestamp with time zone DEFAULT NULL,
  p_finance_approved_to   timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  action_id           uuid,
  claim_id            uuid,
  claim_number        text,
  claim_date          date,
  work_location       text,
  total_amount        numeric,
  claim_status        text,
  owner_name          text,
  owner_designation   text,
  actor_email         text,
  actor_designation   text,
  action              text,
  approval_level      integer,
  notes               text,
  acted_at            timestamp with time zone,
  hod_approved_at     timestamp with time zone,
  finance_approved_at timestamp with time zone
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $func$
  select
    ah.id                          as action_id,
    ah.claim_id,
    c.claim_number,
    c.claim_date,
    wl.location_name               as work_location,
    c.total_amount,
    cs.status_code                 as claim_status,
    owner_emp.employee_name        as owner_name,
    owner_desig.designation_name   as owner_designation,
    actor_emp.employee_email       as actor_email,
    actor_desig.designation_name   as actor_designation,
    ah.action,
    ah.approval_level,
    ah.notes,
    ah.acted_at,
    hod_event.hod_approved_at,
    finance_event.finance_approved_at
  from public.approval_history ah
  join public.expense_claims   c          on c.id          = ah.claim_id
  join public.claim_statuses   cs         on cs.id         = c.status_id
  join public.employees        owner_emp  on owner_emp.id  = c.employee_id
  left join public.work_locations  wl         on wl.id         = c.work_location_id
  left join public.designations    owner_desig on owner_desig.id = owner_emp.designation_id
  left join public.employees       actor_emp  on actor_emp.id  = ah.approver_employee_id
  left join public.designations    actor_desig on actor_desig.id = actor_emp.designation_id
  left join lateral (
    select a.changed_at as hod_approved_at
    from public.claim_status_audit a
    where a.claim_id       = c.id
      and a.actor_scope    = 'approver'
      and a.trigger_action = 'approved'
      and a.to_status      = 'L3_PENDING_FINANCE_REVIEW'
    order by a.changed_at desc
    limit 1
  ) hod_event on true
  left join lateral (
    select a.changed_at as finance_approved_at
    from public.claim_status_audit a
    where a.claim_id       = c.id
      and a.actor_scope    = 'finance'
      and a.trigger_action = 'finance_issued'
    order by a.changed_at desc
    limit 1
  ) finance_event on true
  where
    (p_name_search is null or trim(p_name_search) = ''
      or owner_emp.employee_name ilike ('%' || trim(p_name_search) || '%'))
    and (p_claim_date_from is null or c.claim_date >= p_claim_date_from)
    and (p_claim_date_to   is null or c.claim_date <= p_claim_date_to)
    and (p_hod_approved_from     is null or hod_event.hod_approved_at     >= p_hod_approved_from)
    and (p_hod_approved_to       is null or hod_event.hod_approved_at     <= p_hod_approved_to)
    and (p_finance_approved_from is null or finance_event.finance_approved_at >= p_finance_approved_from)
    and (p_finance_approved_to   is null or finance_event.finance_approved_at <= p_finance_approved_to)
    and (
      p_actor_filters is null
      or cardinality(p_actor_filters) = 0
      or 'all' = any(p_actor_filters)
      or (
        ('sbh' = any(p_actor_filters)
          and actor_emp.designation_id = public.get_designation_id('SBH'))
        or ('finance' = any(p_actor_filters) and exists (
          select 1
          from public.employee_roles er
          join public.roles r on r.id = er.role_id
          where er.employee_id = actor_emp.id
            and er.is_active   = true
            and r.role_code    = 'FINANCE_TEAM'))
        or ('hod' = any(p_actor_filters) and exists (
          select 1
          from public.claim_status_audit hod_audit
          where hod_audit.claim_id            = ah.claim_id
            and hod_audit.actor_employee_id   = ah.approver_employee_id
            and hod_audit.actor_scope         = 'approver'
            and hod_audit.trigger_action      = 'approved'
            and hod_audit.to_status           = 'L3_PENDING_FINANCE_REVIEW'))
      )
    )
    and (
      p_cursor_acted_at is null or p_cursor_action_id is null
      or ah.acted_at < p_cursor_acted_at
      or (ah.acted_at = p_cursor_acted_at and ah.id < p_cursor_action_id)
    )
  order by ah.acted_at desc, ah.id desc
  limit greatest(coalesce(p_limit, 10), 1) + 1;
$func$;

COMMIT;
