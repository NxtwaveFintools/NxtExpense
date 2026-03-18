'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  DATA_TABLE_HEADER_BAR_CLASS,
  DATA_TABLE_PAGINATION_SLOT_CLASS,
  DATA_TABLE_SECTION_CLASS,
} from '@/components/ui/data-table-tokens'
import { submitBulkApprovalAction } from '@/features/approvals/actions'
import { ApprovalListTable } from '@/features/approvals/components/approval-list-table'
import { ApprovalListToolbar } from '@/features/approvals/components/approval-list-toolbar'
import { CursorPaginationControls } from '@/components/ui/cursor-pagination-controls'

import type {
  PendingApproval,
  PaginatedPendingApprovals,
} from '@/features/approvals/types'
import type { ClaimAvailableAction } from '@/features/claims/types'
import {
  getWorkflowActionAllowReclaimLabel,
  getWorkflowActionCtaLabel,
} from '@/lib/utils/workflow-action-labels'

type ApprovalListPagination = {
  backHref: string | null
  nextHref: string | null
  pageNumber: number
}

type ApprovalListProps = {
  approvals: PaginatedPendingApprovals
  pagination: ApprovalListPagination
}

type ApprovalActionIntent = {
  key: string
  actionCode: string
  label: string
  allowResubmit: boolean
}

function getActionIntentKey(
  actionCode: string,
  allowResubmit: boolean
): string {
  return `${actionCode}:${allowResubmit ? 'allow_resubmit' : 'default'}`
}

function toActionIntents(action: ClaimAvailableAction): ApprovalActionIntent[] {
  const intents: ApprovalActionIntent[] = [
    {
      key: getActionIntentKey(action.action, false),
      actionCode: action.action,
      label: getWorkflowActionCtaLabel(action),
      allowResubmit: false,
    },
  ]

  if (action.supports_allow_resubmit) {
    intents.push({
      key: getActionIntentKey(action.action, true),
      actionCode: action.action,
      label: getWorkflowActionAllowReclaimLabel(action),
      allowResubmit: true,
    })
  }

  return intents
}

function supportsIntent(item: PendingApproval, intent: ApprovalActionIntent) {
  return item.availableActions.some(
    (action) =>
      action.action === intent.actionCode &&
      (!intent.allowResubmit || action.supports_allow_resubmit)
  )
}

export function ApprovalList({ approvals, pagination }: ApprovalListProps) {
  const items = approvals.data
  const router = useRouter()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingClaimId, setProcessingClaimId] = useState<string | null>(
    null
  )
  const [processingAction, setProcessingAction] = useState<string | null>(null)

  const allSelectable = useMemo(
    () => items.filter((i: PendingApproval) => i.availableActions.length > 0),
    [items]
  )

  const bulkActionIntents = useMemo(() => {
    const selectedItems = items.filter((item) => selected.has(item.claim.id))
    const sourceItems = selectedItems.length > 0 ? selectedItems : allSelectable
    const intents = new Map<string, ApprovalActionIntent>()

    for (const item of sourceItems) {
      for (const action of item.availableActions) {
        for (const intent of toActionIntents(action)) {
          if (!intents.has(intent.key)) {
            intents.set(intent.key, intent)
          }
        }
      }
    }

    return Array.from(intents.values())
  }, [allSelectable, items, selected])

  const bulkActionIntentMap = useMemo(
    () => new Map(bulkActionIntents.map((intent) => [intent.key, intent])),
    [bulkActionIntents]
  )

  const allSelected =
    allSelectable.length > 0 && selected.size === allSelectable.length

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelected(
        new Set(allSelectable.map((i: PendingApproval) => i.claim.id))
      )
    } else {
      setSelected(new Set())
    }
  }

  function toggleOne(claimId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(claimId)
      } else {
        next.delete(claimId)
      }
      return next
    })
  }

  async function runSingleAction(
    claimId: string,
    action: ClaimAvailableAction,
    allowResubmit: boolean
  ) {
    setIsProcessing(true)
    setProcessingClaimId(claimId)

    const shouldAllowResubmit =
      allowResubmit && action.supports_allow_resubmit === true
    setProcessingAction(getActionIntentKey(action.action, shouldAllowResubmit))

    try {
      const result = await submitBulkApprovalAction({
        claimIds: [claimId],
        action: action.action,
        notes,
        allowResubmit: shouldAllowResubmit ? true : undefined,
      })

      if (!result.ok) {
        toast.error(result.error ?? 'Action failed.')
      } else {
        const successLabel = shouldAllowResubmit
          ? `${getWorkflowActionAllowReclaimLabel(action)} applied.`
          : `${getWorkflowActionCtaLabel(action)} applied.`
        toast.success(successLabel)
        router.refresh()
      }
    } catch {
      toast.error('Unexpected error.')
    } finally {
      setIsProcessing(false)
      setProcessingClaimId(null)
      setProcessingAction(null)
    }
  }

  async function runBulkAction(intent: ApprovalActionIntent) {
    const selectedIds = Array.from(selected)
    const selectedItems = items.filter((item) => selected.has(item.claim.id))
    const eligibleIds = selectedItems
      .filter((item) => supportsIntent(item, intent))
      .map((item) => item.claim.id)

    const ids = selectedIds.length > 0 ? eligibleIds : []
    if (ids.length === 0) {
      toast.info(
        'Select at least one claim with the selected action available.'
      )
      return
    }

    if (eligibleIds.length < selectedIds.length) {
      toast.info(
        'Some selected claims do not support this action and were skipped.'
      )
    }

    setIsProcessing(true)
    setProcessingAction(intent.key)

    try {
      const result = await submitBulkApprovalAction({
        claimIds: ids,
        action: intent.actionCode,
        notes,
        allowResubmit: intent.allowResubmit ? true : undefined,
      })

      if (!result.ok) {
        toast.error(result.error ?? 'Bulk action failed.')
      } else {
        toast.success(`${intent.label} completed.`)
        setSelected(new Set())
        router.refresh()
      }
    } catch {
      toast.error('Unexpected error.')
    } finally {
      setIsProcessing(false)
      setProcessingAction(null)
    }
  }

  if (items.length === 0) {
    return (
      <section className={`${DATA_TABLE_SECTION_CLASS} p-8 text-center`}>
        <h2 className="text-lg font-semibold">Pending Approvals</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No pending claims require your approval right now.
        </p>
      </section>
    )
  }

  return (
    <section className={DATA_TABLE_SECTION_CLASS}>
      <div className={DATA_TABLE_HEADER_BAR_CLASS}>
        <h2 className="text-lg font-semibold">Pending Approvals</h2>
      </div>

      <ApprovalListToolbar
        allSelected={allSelected}
        selectedCount={selected.size}
        selectableCount={allSelectable.length}
        notes={notes}
        isProcessing={isProcessing}
        processingAction={processingAction}
        bulkActions={bulkActionIntents.map((intent) => ({
          key: intent.key,
          label: intent.label,
        }))}
        onToggleSelectAll={toggleSelectAll}
        onNotesChange={setNotes}
        onRunBulkAction={(actionKey) => {
          const intent = bulkActionIntentMap.get(actionKey)
          if (!intent) {
            toast.error('Selected workflow action is unavailable.')
            return
          }

          void runBulkAction(intent)
        }}
      />

      <div className={DATA_TABLE_PAGINATION_SLOT_CLASS}>
        <CursorPaginationControls
          backHref={pagination.backHref}
          nextHref={pagination.nextHref}
          pageNumber={pagination.pageNumber}
        />
      </div>

      <ApprovalListTable
        approvals={approvals}
        selected={selected}
        isProcessing={isProcessing}
        processingClaimId={processingClaimId}
        processingAction={processingAction}
        onToggleOne={toggleOne}
        onRunSingleAction={runSingleAction}
      />
    </section>
  )
}
