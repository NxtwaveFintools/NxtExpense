import type { SupabaseClient } from '@supabase/supabase-js'

import type { FinanceDateFilterField } from '@/features/finance/types'

type FinanceActionDateFilterField = Extract<
  FinanceDateFilterField,
  'finance_approved_date' | 'payment_released_date'
>

type FinanceActionTransitionRow = {
  action_code: string
  to_status_id: string
}

type ClaimStatusIdRow = {
  id: string
}

export function isFinanceActionDateFilterField(
  field: FinanceDateFilterField
): field is FinanceActionDateFilterField {
  return field === 'finance_approved_date' || field === 'payment_released_date'
}

async function getFinanceApprovedStatusIds(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const { data: statuses, error } = await supabase
    .from('claim_statuses')
    .select('id')
    .eq('is_active', true)
    .eq('is_approval', true)
    .eq('is_rejection', false)
    .eq('is_terminal', false)
    .eq('is_payment_issued', false)
    .is('approval_level', null)

  if (error) {
    throw new Error(error.message)
  }

  return new Set((statuses ?? []).map((row) => (row as ClaimStatusIdRow).id))
}

async function getPaymentReleasedStatusIds(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const { data: statuses, error } = await supabase
    .from('claim_statuses')
    .select('id')
    .eq('is_payment_issued', true)
    .eq('is_active', true)

  if (error) {
    throw new Error(error.message)
  }

  return new Set((statuses ?? []).map((row) => (row as ClaimStatusIdRow).id))
}

export async function getDateFilterTargetStatusIds(
  supabase: SupabaseClient,
  dateFilterField: FinanceActionDateFilterField
): Promise<Set<string>> {
  return dateFilterField === 'finance_approved_date'
    ? getFinanceApprovedStatusIds(supabase)
    : getPaymentReleasedStatusIds(supabase)
}

function normalizeFinanceHistoryActionCode(
  actionCode: string,
  toStatusId: string,
  paymentIssuedStatusIds: Set<string>
): string {
  if (
    paymentIssuedStatusIds.has(toStatusId) &&
    actionCode.startsWith('finance_')
  ) {
    return actionCode.slice('finance_'.length)
  }

  return actionCode
}

export async function getFinanceActionCodesForDateFilter(
  supabase: SupabaseClient,
  dateFilterField: FinanceActionDateFilterField,
  targetStatusIds?: Set<string>
): Promise<string[]> {
  const resolvedStatusIds =
    targetStatusIds ??
    (await getDateFilterTargetStatusIds(supabase, dateFilterField))

  if (resolvedStatusIds.size === 0) {
    return []
  }

  const { data: transitionRows, error: transitionError } = await supabase
    .from('claim_status_transitions')
    .select('action_code, to_status_id')
    .eq('is_active', true)
    .in('to_status_id', [...resolvedStatusIds])

  if (transitionError) {
    throw new Error(transitionError.message)
  }

  return [
    ...new Set(
      ((transitionRows ?? []) as FinanceActionTransitionRow[]).map((row) =>
        dateFilterField === 'payment_released_date'
          ? normalizeFinanceHistoryActionCode(
              row.action_code,
              row.to_status_id,
              resolvedStatusIds
            )
          : row.action_code
      )
    ),
  ]
}
