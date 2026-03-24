-- #region agent log
do $$
begin
  raise notice '[agent-log][session=0c4042][hypothesis=H4] restoring function grants after parser-safe migration split';

  if to_regprocedure('public.bulk_finance_actions_atomic(uuid[],public.finance_action_type,text)') is not null then
    execute 'grant execute on function public.bulk_finance_actions_atomic(uuid[], public.finance_action_type, text) to authenticated';
  end if;

  if to_regprocedure('public.submit_approval_action_atomic(uuid,public.approval_action_type,text,boolean)') is not null then
    execute 'grant execute on function public.submit_approval_action_atomic(uuid, public.approval_action_type, text, boolean) to authenticated';
  end if;

  if to_regprocedure('public.resubmit_claim_after_rejection_atomic(uuid,text)') is not null then
    execute 'grant execute on function public.resubmit_claim_after_rejection_atomic(uuid, text) to authenticated';
  end if;

  if to_regprocedure('public.submit_finance_action_atomic(uuid,public.finance_action_type,text,boolean)') is not null then
    execute 'grant execute on function public.submit_finance_action_atomic(uuid, public.finance_action_type, text, boolean) to authenticated';
  end if;

  if to_regprocedure('public.bulk_finance_actions_atomic(uuid[],public.finance_action_type,text,boolean)') is not null then
    execute 'grant execute on function public.bulk_finance_actions_atomic(uuid[], public.finance_action_type, text, boolean) to authenticated';
  end if;

  if to_regprocedure('public.admin_rollback_claim_atomic(uuid,text,text)') is not null then
    execute 'grant execute on function public.admin_rollback_claim_atomic(uuid, text, text) to authenticated';
  end if;

  if to_regprocedure('public.admin_reassign_employee_approvers_atomic(uuid,text,text,text,text,text)') is not null then
    execute 'grant execute on function public.admin_reassign_employee_approvers_atomic(uuid, text, text, text, text, text) to authenticated';
  end if;

  if to_regprocedure('public.get_claim_available_actions(uuid)') is not null then
    execute 'grant execute on function public.get_claim_available_actions(uuid) to authenticated';
  end if;

  if to_regprocedure('public.get_filtered_approval_history(int,timestamptz,uuid,text,text[],date,date,timestamptz,timestamptz,timestamptz,timestamptz)') is not null then
    execute 'grant execute on function public.get_filtered_approval_history(int, timestamptz, uuid, text, text[], date, date, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated';
  end if;
end;
$$;
-- #endregion
