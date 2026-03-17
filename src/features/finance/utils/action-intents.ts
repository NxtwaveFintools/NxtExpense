import type {
  FinanceActionType,
  FinanceQueueItem,
} from '@/features/finance/types'

export type FinanceActionIntent =
  | FinanceActionType
  | 'finance_rejected_allow_reclaim'

export function supportsFinanceIntent(
  item: Pick<FinanceQueueItem, 'availableActions'>,
  intent: FinanceActionIntent
): boolean {
  if (intent === 'issued') {
    return item.availableActions.some((action) => action.action === 'issued')
  }

  if (intent === 'finance_rejected') {
    return item.availableActions.some(
      (action) => action.action === 'finance_rejected'
    )
  }

  return item.availableActions.some(
    (action) => action.action === 'finance_rejected'
  )
}

export function getFinanceSuccessLabel(
  intent: FinanceActionIntent,
  processedCount: number
): string {
  const count = Math.max(1, processedCount)

  if (intent === 'issued') {
    return count === 1
      ? 'Payment issued successfully.'
      : `Payments issued for ${count} claims.`
  }

  if (intent === 'finance_rejected_allow_reclaim') {
    return count === 1
      ? 'Claim rejected and reclaim allowed.'
      : `Rejected ${count} claims and allowed reclaim.`
  }

  return count === 1
    ? 'Claim rejected successfully.'
    : `Rejected ${count} claims successfully.`
}
