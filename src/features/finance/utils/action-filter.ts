import type { FinanceActionFilter } from '@/features/finance/types'

const REJECT_ACTION_CODES = ['rejected', 'finance_rejected'] as const

export const REJECTED_ALLOW_RECLAIM_ACTION_FILTER_VALUE =
  'rejected_allow_reclaim'
export const REJECTED_ALLOW_RECLAIM_ACTION_FILTER_LABEL =
  'Rejected & Allow Reclaim'

export function isRejectedAllowReclaimActionFilter(
  actionFilter: FinanceActionFilter
): boolean {
  return actionFilter === REJECTED_ALLOW_RECLAIM_ACTION_FILTER_VALUE
}

export function getFinanceActionCodesForFilter(
  actionFilter: FinanceActionFilter
): string[] {
  if (!actionFilter) {
    return []
  }

  if (isRejectedAllowReclaimActionFilter(actionFilter)) {
    return [...REJECT_ACTION_CODES]
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
