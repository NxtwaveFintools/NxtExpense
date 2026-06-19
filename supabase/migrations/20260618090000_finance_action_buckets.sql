-- Layer 0: single source of truth for finance action classification.
-- Ports getFinanceActionBuckets() + normalizeFinanceHistoryActionCode() from
-- src/features/finance/data/queries/history-analytics.query.ts into SQL.
create or replace function public.finance_action_buckets()
returns table(
  action               text,
  is_approved          boolean,
  is_rejected          boolean,
  is_finance_approved  boolean,
  is_payment_released  boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with s as (
    select id, approval_level, is_approval, is_rejection, is_terminal, is_payment_issued
    from claim_statuses
    where is_active
  ),
  t as (
    select action_code, to_status_id
    from claim_status_transitions
    where is_active
  )
  select
    case
      when s.is_payment_issued and t.action_code like 'finance_%'
        then substr(t.action_code, length('finance_') + 1)
      else t.action_code
    end as action,
    (
      s.is_payment_issued
      or (s.is_approval and not s.is_rejection and not s.is_terminal
          and not s.is_payment_issued and s.approval_level is null)
    ) as is_approved,
    s.is_rejection as is_rejected,
    (
      s.is_approval and not s.is_rejection and not s.is_terminal
      and not s.is_payment_issued and s.approval_level is null
    ) as is_finance_approved,
    s.is_payment_issued as is_payment_released
  from t
  join s on s.id = t.to_status_id;
$$;

grant execute on function public.finance_action_buckets() to authenticated, service_role;
