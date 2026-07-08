import type { SupabaseClient } from '@supabase/supabase-js'

import type { FinanceActionFilter } from '@/features/finance/types'

// Only used by hasRejectFinanceActionCode below, which has no live callers as
// of the finance-history dropdown fix (docs/superpowers/plans/2026-07-02-finance-history-dropdown-and-canonical-filter-plan.md
// Task 1). getFinanceActionCodesForFilter no longer uses this hardcoded list —
// see below.
const REJECT_ACTION_CODES = ['rejected', 'finance_rejected'] as const

export const REJECTED_ALLOW_RECLAIM_ACTION_FILTER_VALUE =
  'rejected_allow_reclaim'
export const REJECTED_ALLOW_RECLAIM_ACTION_FILTER_LABEL =
  'Rejected & Allow Reclaim'

function isRejectedAllowReclaimActionFilter(
  actionFilter: FinanceActionFilter
): boolean {
  return actionFilter === REJECTED_ALLOW_RECLAIM_ACTION_FILTER_VALUE
}

type FinanceActionBucketRow = {
  action: string
  is_rejected: boolean
}

// Derives the rejected-bucket action codes from finance_action_buckets() (the
// authoritative source, backed by claim_status_transitions/claim_statuses —
// see supabase/migrations/20260618090000_finance_action_buckets.sql) instead
// of a hardcoded action-code list, so a new rejection-classified action code
// is picked up automatically rather than requiring a matching code change here.
export async function getFinanceActionCodesForFilter(
  supabase: SupabaseClient,
  actionFilter: FinanceActionFilter
): Promise<string[]> {
  if (!actionFilter) {
    return []
  }

  if (isRejectedAllowReclaimActionFilter(actionFilter)) {
    const { data, error } = await supabase.rpc('finance_action_buckets')

    if (error) {
      throw new Error(error.message)
    }

    return ((data ?? []) as FinanceActionBucketRow[])
      .filter((row) => row.is_rejected)
      .map((row) => row.action)
  }

  return [actionFilter]
}

export function shouldForceAllowResubmitFromActionFilter(
  actionFilter: FinanceActionFilter
): boolean {
  return isRejectedAllowReclaimActionFilter(actionFilter)
}

export function hasRejectFinanceActionCode(actionCodes: string[]): boolean {
  return actionCodes.some((code) =>
    REJECT_ACTION_CODES.includes(code as (typeof REJECT_ACTION_CODES)[number])
  )
}
