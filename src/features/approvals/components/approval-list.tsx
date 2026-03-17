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

export function ApprovalList({ approvals, pagination }: ApprovalListProps) {
  const items = approvals.data
  const router = useRouter()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')
  const [allowResubmit, setAllowResubmit] = useState(false)
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
    action: ClaimAvailableAction
  ) {
    setIsProcessing(true)
    setProcessingClaimId(claimId)
    setProcessingAction(action.action)

    try {
      const result = await submitBulkApprovalAction({
        claimIds: [claimId],
        action: action.action as 'approved' | 'rejected',
        notes,
        allowResubmit: action.action === 'rejected' ? allowResubmit : undefined,
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

  async function runBulkAction(action: 'approved' | 'rejected') {
    const ids = Array.from(selected)
    if (ids.length === 0) {
      toast.info('Select at least one claim.')
      return
    }

    setIsProcessing(true)
    setProcessingAction(action)

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
        toast.success(`Bulk ${action} completed.`)
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
        allowResubmit={allowResubmit}
        isProcessing={isProcessing}
        processingAction={processingAction}
        onToggleSelectAll={toggleSelectAll}
        onNotesChange={setNotes}
        onAllowResubmitChange={setAllowResubmit}
        onApproveSelected={() => runBulkAction('approved')}
        onRejectSelected={() => runBulkAction('rejected')}
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
