BEGIN;

-- =============================================================================
-- Migration 150: Fix Approval History search and RLS
--
-- Problems fixed:
-- 1. get_filtered_approval_history ran as SECURITY INVOKER — the JOIN on
--    expense_claims failed for approvers because the table's RLS only allows
--    them to SELECT claims that are CURRENTLY PENDING at their level.
--    Historically approved/issued claims were invisible, making employee-name
--    search return empty results.
-- 2. When an approver navigated to an approval detail page for a claim they had
--    already acted on (now at a later status), expense_claims RLS blocked the
--    SELECT inside getClaimById → notFound() was triggered.
-- 3. expense_claims UPDATE policy only permitted DRAFT/RETURNED_FOR_MODIFICATION,
--    preventing employees from re-filing a terminally rejected claim for the
--    same date (the unique(employee_id, claim_date) constraint means the rejected
--    row must be UPDATE-d with fresh data rather than INSERT-ed again).
--
-- Fixes:
-- A. Rewrite get_filtered_approval_history as SECURITY DEFINER with an
--    internal scope guard (owner OR approver-actor OR admin).
-- B. Add "approver reads historically actioned claims" policy on expense_claims.
-- C. Add matching item-level policy on expense_claim_items.
-- D. Expand "employee updates own draft or returned claims" to include any
--    claim whose status has is_rejection = true.
-- =============================================================================

-- =============================================================================
-- A. Rewrite get_filtered_approval_history — SECURITY DEFINER + scope guard
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
SECURITY DEFINER
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
    -- ── Scope guard: caller must be the claim owner, an actor on this
    --    history entry, or an admin ──────────────────────────────────
    (
      -- Claim owner sees full history of their own claims
      c.employee_id = (
        SELECT e.id FROM public.employees e
        WHERE lower(e.employee_email) = current_user_email()
      )
      -- Approver sees history entries where they were the actor
      OR ah.approver_employee_id = (
        SELECT e.id FROM public.employees e
        WHERE lower(e.employee_email) = current_user_email()
      )
      -- Admin sees everything
      OR EXISTS (
        SELECT 1
        FROM public.employees adm
          JOIN public.employee_roles er ON er.employee_id = adm.id AND er.is_active = true
          JOIN public.roles r            ON r.id          = er.role_id
        WHERE lower(adm.employee_email) = current_user_email()
          AND r.role_code = 'ADMIN'
      )
    )
    -- ── User-supplied filters ──────────────────────────────────────
    and (p_name_search is null or trim(p_name_search) = ''
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

GRANT EXECUTE ON FUNCTION public.get_filtered_approval_history(
  integer, timestamptz, uuid, text, text[], date, date,
  timestamptz, timestamptz, timestamptz, timestamptz
) TO authenticated;

-- =============================================================================
-- B. expense_claims — approver can SELECT claims they have historically acted on
-- =============================================================================
CREATE POLICY "approver reads historically actioned claims"
  ON expense_claims
  FOR SELECT
  USING (
    id IN (
      SELECT ah.claim_id
      FROM public.approval_history ah
        JOIN public.employees e ON e.id = ah.approver_employee_id
      WHERE lower(e.employee_email) = current_user_email()
    )
  );

-- =============================================================================
-- C. expense_claim_items — matching policy for historically actioned claims
-- =============================================================================
CREATE POLICY "approver reads claim items for historically actioned claims"
  ON expense_claim_items
  FOR SELECT
  USING (
    claim_id IN (
      SELECT ah.claim_id
      FROM public.approval_history ah
        JOIN public.employees e ON e.id = ah.approver_employee_id
      WHERE lower(e.employee_email) = current_user_email()
    )
  );

-- =============================================================================
-- D. Expand expense_claims UPDATE policy so employees can re-file a
--    terminally rejected claim (unique constraint prevents a fresh INSERT;
--    the application layer updates the rejected row and resubmits it).
-- =============================================================================
DROP POLICY IF EXISTS "employee updates own draft or returned claims" ON expense_claims;

CREATE POLICY "employee updates own draft or returned claims"
  ON expense_claims
  FOR UPDATE
  USING (
    employee_id = (
      SELECT e.id FROM employees e
      WHERE lower(e.employee_email) = current_user_email()
    )
    AND status_id IN (
      SELECT cs.id FROM claim_statuses cs
      WHERE cs.status_code = 'DRAFT'
        OR cs.status_code = 'RETURNED_FOR_MODIFICATION'
        OR cs.is_rejection = true
    )
  )
  WITH CHECK (
    employee_id = (
      SELECT e.id FROM employees e
      WHERE lower(e.employee_email) = current_user_email()
    )
  );

COMMIT;
