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

export function getFinanceActionIntentKey(
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
