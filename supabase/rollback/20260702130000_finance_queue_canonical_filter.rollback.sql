-- Rollback for 20260702130000_finance_queue_canonical_filter.sql
-- Restores get_finance_queue_page and get_finance_queue_count verbatim from
-- 20260618092000_get_finance_queue_page.sql and
-- 20260618092200_get_finance_queue_count.sql, then drops the canonical
-- function (safe to drop last — restoring the two RPCs' original bodies
-- removes their only references to it).

create or replace function public.get_finance_queue_page(
  p_required_status_id uuid,
  p_has_filters        boolean     default false,
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
  p_date_to            timestamptz default null,
  p_cursor_created_at  timestamptz default null,
  p_cursor_id          uuid        default null,
  p_limit              integer     default 10
)
returns table(id uuid, created_at timestamptz)
language sql stable security invoker set search_path = public
as $$
  with base as (
    select ec.id, ec.created_at
    from expense_claims ec
    where ec.status_id = p_required_status_id
      and (
        p_cursor_created_at is null
        or ec.created_at < p_cursor_created_at
        or (ec.created_at = p_cursor_created_at and ec.id < p_cursor_id)
      )
  )
  select b.id, b.created_at
  from base b
  join public.finance_filtered_claim_ids(
    p_required_status_id, p_employee_id, p_employee_name, p_claim_number,
    p_owner_designation, p_hod_approver_emp, p_claim_status, p_work_location,
    p_action_filter, p_date_field, p_date_from, p_date_to
  ) f on f.id = b.id
  where p_has_filters
  union all
  select b.id, b.created_at
  from base b
  where not p_has_filters
  order by created_at desc, id desc
  limit p_limit + 1;
$$;

grant execute on function public.get_finance_queue_page(
  uuid,boolean,text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz,
  timestamptz,uuid,integer
) to authenticated, service_role;

create or replace function public.get_finance_queue_count(
  p_required_status_id uuid,
  p_has_filters        boolean     default false,
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
returns bigint
language sql stable security invoker set search_path = public
as $$
  select case
    when p_has_filters then (
      select count(*)
      from public.finance_filtered_claim_ids(
        p_required_status_id, p_employee_id, p_employee_name, p_claim_number,
        p_owner_designation, p_hod_approver_emp, p_claim_status, p_work_location,
        p_action_filter, p_date_field, p_date_from, p_date_to
      )
    )
    else (
      select count(*)
      from public.expense_claims ec
      where ec.status_id = p_required_status_id
    )
  end;
$$;

grant execute on function public.get_finance_queue_count(
  uuid,boolean,text,text,text,uuid,uuid,text,uuid,text,text,timestamptz,timestamptz
) to authenticated, service_role;

drop function if exists public.finance_queue_filtered(
  uuid, boolean, text, text, text, uuid, uuid, text, uuid, text, text, timestamptz, timestamptz
);
