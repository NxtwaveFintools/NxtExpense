import type { ClaimAvailableAction } from '@/features/claims/types'
import type { FinanceQueueItem } from '@/features/finance/types'
import {
  getWorkflowActionAllowReclaimLabel,
  getWorkflowActionCtaLabel,
} from '@/lib/utils/workflow-action-labels'

export type FinanceActionIntent = {
  key: string
  actionCode: string
  label: string
  allowResubmit: boolean
}

function getFinanceActionIntentKey(
  actionCode: string,
  allowResubmit: boolean
): string {
  return `${actionCode}:${allowResubmit ? 'allow_resubmit' : 'default'}`
}

export function buildFinanceActionIntents(
  action: ClaimAvailableAction
): FinanceActionIntent[] {
  const intents: FinanceActionIntent[] = [
    {
      key: getFinanceActionIntentKey(action.action, false),
      actionCode: action.action,
      label: getWorkflowActionCtaLabel(action),
      allowResubmit: false,
    },
  ]

  if (action.supports_allow_resubmit) {
    intents.push({
      key: getFinanceActionIntentKey(action.action, true),
      actionCode: action.action,
      label: getWorkflowActionAllowReclaimLabel(action),
      allowResubmit: true,
    })
  }

  return intents
}

function isFinanceApproveAction(actionCode: string): boolean {
  return (
    actionCode === 'issued' ||
    actionCode === 'finance_issued' ||
    actionCode === 'approved' ||
    actionCode === 'finance_approved'
  )
}

function isFinanceReleaseAction(actionCode: string): boolean {
  return actionCode === 'payment_released' || actionCode === 'released'
}

function isFinanceRejectAction(actionCode: string): boolean {
  return actionCode === 'finance_rejected' || actionCode === 'rejected'
}

function getFinanceIntentSortRank(intent: FinanceActionIntent): number {
  if (isFinanceReleaseAction(intent.actionCode) && !intent.allowResubmit) {
    return 1
  }

  if (isFinanceApproveAction(intent.actionCode) && !intent.allowResubmit) {
    return 2
  }

  if (isFinanceRejectAction(intent.actionCode) && !intent.allowResubmit) {
    return 3
  }

  if (isFinanceRejectAction(intent.actionCode) && intent.allowResubmit) {
    return 4
  }

  return 99
}

export function sortFinanceActionIntents(
  intents: FinanceActionIntent[]
): FinanceActionIntent[] {
  return [...intents].sort((left, right) => {
    const rankDifference =
      getFinanceIntentSortRank(left) - getFinanceIntentSortRank(right)
    if (rankDifference !== 0) {
      return rankDifference
    }

    return left.label.localeCompare(right.label)
  })
}

export function getFinanceActionToneClass(intent: FinanceActionIntent): string {
  if (isFinanceReleaseAction(intent.actionCode) && !intent.allowResubmit) {
    return 'bg-emerald-600 hover:bg-emerald-700'
  }

  if (isFinanceApproveAction(intent.actionCode) && !intent.allowResubmit) {
    return 'bg-emerald-600 hover:bg-emerald-700'
  }

  if (isFinanceRejectAction(intent.actionCode) && !intent.allowResubmit) {
    return 'bg-rose-600 hover:bg-rose-700'
  }

  if (isFinanceRejectAction(intent.actionCode) && intent.allowResubmit) {
    return 'bg-amber-600 hover:bg-amber-700'
  }

  return 'bg-sky-600 hover:bg-sky-700'
}

export function supportsFinanceIntent(
  item: Pick<FinanceQueueItem, 'availableActions'>,
  intent: FinanceActionIntent
): boolean {
  return item.availableActions.some(
    (action) =>
      action.action === intent.actionCode &&
      (!intent.allowResubmit || action.supports_allow_resubmit)
  )
}

export function getFinanceSuccessLabel(
  intent: FinanceActionIntent,
  processedCount: number
): string {
  const count = Math.max(1, processedCount)
  return count === 1
    ? `${intent.label} completed successfully.`
    : `${intent.label} completed for ${count} claims.`
}
