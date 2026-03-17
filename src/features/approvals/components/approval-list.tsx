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

type ApprovalListPagination = {
  backHref: string | null
  nextHref: string | null
  pageNumber: number
}

type ApprovalListProps = {
  approvals: PaginatedPendingApprovals
  pagination: ApprovalListPagination
}

type ApprovalActionIntent = 'approved' | 'rejected' | 'rejected_allow_reclaim'

function supportsIntent(item: PendingApproval, intent: ApprovalActionIntent) {
  if (intent === 'approved') {
    return item.availableActions.some((action) => action.action === 'approved')
  }

  if (intent === 'rejected') {
    return item.availableActions.some((action) => action.action === 'rejected')
  }

  return item.availableActions.some((action) => action.action === 'rejected')
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
    () =>
      items.filter((i: PendingApproval) =>
        i.availableActions.some(
          (a: ClaimAvailableAction) =>
            a.action === 'approved' || a.action === 'rejected'
        )
      ),
    [items]
  )

  const hasRejectAllowReclaimAction = useMemo(() => {
    const selectedItems = items.filter((item) => selected.has(item.claim.id))
    const sourceItems = selectedItems.length > 0 ? selectedItems : allSelectable

    return sourceItems.some((item) =>
      item.availableActions.some((action) => action.action === 'rejected')
    )
  }, [allSelectable, items, selected])

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
    allowReclaim: boolean
  ) {
    setIsProcessing(true)
    setProcessingClaimId(claimId)

    const intent: ApprovalActionIntent =
      action.action === 'rejected' && allowReclaim
        ? 'rejected_allow_reclaim'
        : (action.action as ApprovalActionIntent)
    setProcessingAction(intent)

    try {
      const result = await submitBulkApprovalAction({
        claimIds: [claimId],
        action: action.action as 'approved' | 'rejected',
        notes,
        allowResubmit: action.action === 'rejected' ? allowReclaim : undefined,
      })

      if (!result.ok) {
        toast.error(result.error ?? 'Action failed.')
      } else {
        toast.success(`${action.display_label} applied.`)
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

    const action: 'approved' | 'rejected' =
      intent === 'approved' ? 'approved' : 'rejected'
    const allowResubmit = intent === 'rejected_allow_reclaim'

    setIsProcessing(true)
    setProcessingAction(intent)

    try {
      const result = await submitBulkApprovalAction({
        claimIds: ids,
        action,
        notes,
        allowResubmit: action === 'rejected' ? allowResubmit : undefined,
      })

      if (!result.ok) {
        toast.error(result.error ?? 'Bulk action failed.')
      } else {
        const successLabel =
          intent === 'approved'
            ? 'Bulk approve completed.'
            : intent === 'rejected_allow_reclaim'
              ? 'Bulk reject with reclaim completed.'
              : 'Bulk reject completed.'
        toast.success(successLabel)
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
        canRejectAllowReclaim={hasRejectAllowReclaimAction}
        isProcessing={isProcessing}
        processingAction={processingAction}
        onToggleSelectAll={toggleSelectAll}
        onNotesChange={setNotes}
        onApproveSelected={() => runBulkAction('approved')}
        onRejectSelected={() => runBulkAction('rejected')}
        onRejectAllowReclaimSelected={() =>
          runBulkAction('rejected_allow_reclaim')
        }
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
