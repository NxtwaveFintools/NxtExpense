-- Fix: finance_filtered_claim_ids ILIKE patterns for p_employee_id and p_employee_name
-- did not escape LIKE metacharacters (% and _). The sibling get_pending_approvals SQL
-- already escapes them correctly; this aligns finance to match.
--
-- Impact is currently theoretical (NW-prefixed employee IDs contain no metacharacters)
-- but the gap is a latent correctness issue — any future ID format or a name search
-- containing a literal underscore/percent would over-match.
--
-- Same escape pattern used in get_pending_approvals (20260622092000):
--   replace(replace(value, '%', '\%'), '_', '\_')
-- PostgreSQL ILIKE uses '\' as the default escape character so no ESCAPE clause needed.

create or replace function public.finance_filtered_claim_ids(
  p_required_status_id uuid        default null,
  p_employee_id        text        default null,
  p_employee_name      text        default null,
  p_claim_number       text        default null,
  p_owner_designation  uuid        default null,
  p_hod_approver_emp   uuid        default null,
  p_claim_status       text        default null,
  p_work_location      uuid        default null,
  p_action_filter      text        default null,
  p_date_field         text        default 'claim_date',
  p_date_from          timestamptz default null,
  p_date_to            timestamptz default null
)
returns table(id uuid)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id
  from expense_claims c
  join employees e on e.id = c.employee_id
  where
    (p_required_status_id is null or c.status_id = p_required_status_id)
    and (p_claim_status is null or c.status_id = split_part(p_claim_status, ':', 1)::uuid)
    -- allow_resubmit resolution (single rule):
    --   '<uuid>:allow_resubmit' status filter  -> only allow_resubmit = true
    --   actionFilter 'rejected_allow_reclaim'  -> only allow_resubmit = true
    --   otherwise (default finance view)        -> exclude resubmit-pending duplicates
    and (
      case
        when p_claim_status like '%:allow_resubmit'     then c.allow_resubmit is true
        when p_action_filter = 'rejected_allow_reclaim' then c.allow_resubmit is true
        else c.allow_resubmit is not true
      end
    )
    and (p_employee_id   is null or e.employee_id   ilike '%' || replace(replace(p_employee_id,   '%', '\%'), '_', '\_') || '%')
    and (p_employee_name is null or e.employee_name ilike '%' || replace(replace(p_employee_name, '%', '\%'), '_', '\_') || '%')
    and (p_claim_number  is null or c.claim_number = p_claim_number)
    and (p_work_location is null or c.work_location_id = p_work_location)
    and (p_owner_designation is null or e.designation_id = p_owner_designation)
    -- claim-column date filters
    and (p_date_field <> 'claim_date'   or p_date_from is null or c.claim_date   >= p_date_from)
    and (p_date_field <> 'claim_date'   or p_date_to   is null or c.claim_date   <= p_date_to)
    and (p_date_field <> 'submitted_at' or p_date_from is null or c.submitted_at >= p_date_from)
    and (p_date_field <> 'submitted_at' or p_date_to   is null or c.submitted_at <= p_date_to)
    -- finance-action date filters (payment_released_date / finance_approved_date).
    -- Mirrors getFilteredClaimIdsForFinance(): a claim qualifies only when BOTH
    --   (a) its CURRENT status is in the date field's target status class
    --       (getDateFilterTargetStatusIds), AND
    --   (b) a matching finance_action falls inside the date range.
    -- The current-status scope (a) is load-bearing: without it, claims that were
    -- finance-approved in range but have since moved on (e.g. to payment-released)
    -- leak in. Verified on dev data: 88 of 181 finance_approved claims have a
    -- non-finance-approved current status, so omitting (a) breaks parity.
    and (
      p_date_field not in ('payment_released_date', 'finance_approved_date')
      or (
        exists (
          select 1
          from claim_statuses cs
          where cs.id = c.status_id
            and cs.is_active
            and (
              (p_date_field = 'payment_released_date' and cs.is_payment_issued)
              or (
                p_date_field = 'finance_approved_date'
                and cs.is_approval and not cs.is_rejection and not cs.is_terminal
                and not cs.is_payment_issued and cs.approval_level is null
              )
            )
        )
        and exists (
          select 1
          from finance_actions fa
          join finance_action_buckets() b on b.action = fa.action
          where fa.claim_id = c.id
            and (
              (p_date_field = 'payment_released_date' and b.is_payment_released)
              or (p_date_field = 'finance_approved_date' and b.is_finance_approved)
            )
            and (p_date_from is null or fa.acted_at >= p_date_from)
            and (p_date_to   is null or fa.acted_at <= p_date_to)
        )
      )
    )
    -- HOD approver and/or hod_approved_date (finance-review status = level 3, not approval/rejection/terminal)
    and (
      (p_hod_approver_emp is null and p_date_field <> 'hod_approved_date')
      or exists (
        select 1
        from approval_history ah
        join claim_statuses fs
          on fs.id = ah.new_status_id
         and fs.approval_level = 3
         and fs.is_approval = false
         and fs.is_rejection = false
         and fs.is_terminal = false
         and fs.is_active = true
        where ah.claim_id = c.id
          and (p_hod_approver_emp is null or ah.approver_employee_id = p_hod_approver_emp)
          and (p_date_field <> 'hod_approved_date' or p_date_from is null or ah.acted_at >= p_date_from)
          and (p_date_field <> 'hod_approved_date' or p_date_to   is null or ah.acted_at <= p_date_to)
      )
    );
$$;

grant execute on function public.finance_filtered_claim_ids(
  uuid, text, text, text, uuid, uuid, text, uuid, text, text, timestamptz, timestamptz
) to authenticated, service_role;
