'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import type { ClaimAvailableAction } from '@/features/claims/types'
import type {
  FinanceActionType,
  PaginatedFinanceQueue,
} from '@/features/finance/types'
import {
  bulkFinanceClaimsAction,
  submitFinanceAction,
} from '@/features/finance/actions'
import { CursorPaginationControls } from '@/components/ui/cursor-pagination-controls'
import {
  DATA_TABLE_BODY_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_SCROLL_WRAPPER_CLASS,
  getDataTableHeadCellClass,
} from '@/components/ui/data-table-tokens'
import { FinanceClaimRow } from '@/features/finance/components/finance-claim-row'
import { FinanceQueueToolbar } from '@/features/finance/components/finance-queue-toolbar'

type FinanceQueueProps = {
  queue: PaginatedFinanceQueue
  pagination: {
    backHref: string | null
    nextHref: string | null
    pageNumber: number
  }
}

export function FinanceQueue({ queue, pagination }: FinanceQueueProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [allowResubmit, setAllowResubmit] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [processingClaimId, setProcessingClaimId] = useState<string | null>(
    null
  )
  const [pendingBulkAction, setPendingBulkAction] =
    useState<FinanceActionType | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectableClaimIds = useMemo(
    () =>
      queue.data
        .filter((item) =>
          item.availableActions.some(
            (action) =>
              action.action === 'issued' || action.action === 'finance_rejected'
          )
        )
        .map((item) => item.claim.id),
    [queue.data]
  )

  const bulkActions = useMemo(() => {
    const actions = new Map<FinanceActionType, string>()

    queue.data.forEach((item) => {
      item.availableActions.forEach((action) => {
        if (
          action.action === 'issued' ||
          action.action === 'finance_rejected'
        ) {
          actions.set(action.action, `${action.display_label} Selected`)
        }
      })
    })

    return Array.from(actions.entries()).map(([action, label]) => ({
      action,
      label,
    }))
  }, [queue.data])

  const allSelected =
    selectableClaimIds.length > 0 &&
    selectedIds.length === selectableClaimIds.length
  const partiallySelected = selectedIds.length > 0 && !allSelected

  function toggleClaim(claimId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return [...current, claimId]
      }
      return current.filter((id) => id !== claimId)
    })
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? selectableClaimIds : [])
  }

  async function handleBulkAction(action: FinanceActionType) {
    if (selectedIds.length === 0) {
      return
    }

    setIsSubmitting(true)
    setProcessingClaimId(null)
    setPendingBulkAction(action)
    setError(null)

    try {
      const result = await bulkFinanceClaimsAction({
        claimIds: selectedIds,
        action,
        notes,
        allowResubmit: action === 'finance_rejected' ? allowResubmit : false,
      })

      if (!result.ok) {
        setError(result.error)
        toast.error(result.error ?? 'Unable to process selected claims.')
        return
      }

      toast.success('Bulk finance action completed.')
      setSelectedIds([])
      router.refresh()
    } catch {
      const message = 'Unexpected error while processing selected claims.'
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
      setPendingBulkAction(null)
    }
  }

  async function handleSingleAction(
    claimId: string,
    availableAction: ClaimAvailableAction
  ) {
    if (
      availableAction.action !== 'issued' &&
      availableAction.action !== 'finance_rejected'
    ) {
      setError('Unsupported finance action from workflow configuration.')
      return
    }

    setIsSubmitting(true)
    setProcessingClaimId(claimId)
    setError(null)

    try {
      const result = await submitFinanceAction({
        claimId,
        action: availableAction.action,
        notes,
        allowResubmit:
          availableAction.action === 'finance_rejected' ? allowResubmit : false,
      })

      if (!result.ok) {
        setError(result.error)
        toast.error(result.error ?? 'Unable to complete finance action.')
        return
      }

      toast.success(`${availableAction.display_label} completed successfully.`)
      router.refresh()
    } catch {
      const message = 'Unexpected error while processing finance action.'
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
      setProcessingClaimId(null)
    }
  }

  if (queue.data.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">Finance Queue</h2>
        <p className="mt-2 text-sm text-foreground/70">
          No claims are waiting for finance action.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold">Finance Queue</h2>

      <CursorPaginationControls
        className="mt-3"
        backHref={pagination.backHref}
        nextHref={pagination.nextHref}
        pageNumber={pagination.pageNumber}
      />

      {error ? (
        <p className="mt-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <label className="mt-3 block space-y-2 text-sm">
        <span className="text-foreground/80">Notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>

      <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={allowResubmit}
          onChange={(e) => setAllowResubmit(e.target.checked)}
          className="h-4 w-4 rounded"
        />
        <span className="text-amber-700 dark:text-amber-400">
          Allow employee to raise a new claim (applies to Finance Reject only)
        </span>
      </label>

      <div className="mt-4">
        <FinanceQueueToolbar
          selectedCount={selectedIds.length}
          allSelected={allSelected}
          partiallySelected={partiallySelected}
          totalCount={selectableClaimIds.length}
          bulkActions={bulkActions}
          onToggleSelectAll={toggleSelectAll}
          onBulkAction={handleBulkAction}
          disabled={isSubmitting}
          processingAction={pendingBulkAction}
        />

        <div className={DATA_TABLE_SCROLL_WRAPPER_CLASS}>
          <table className={`${DATA_TABLE_CLASS} min-w-185 border-collapse`}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={getDataTableHeadCellClass()}>Select</th>
                <th className={getDataTableHeadCellClass({ nowrap: true })}>
                  Claim ID
                </th>
                <th className={getDataTableHeadCellClass()}>Employee</th>
                <th className={getDataTableHeadCellClass()}>Date</th>
                <th className={getDataTableHeadCellClass()}>Location</th>
                <th className={getDataTableHeadCellClass()}>Amount</th>
              </tr>
            </thead>
            <tbody className={DATA_TABLE_BODY_CLASS}>
              {queue.data.map((item) => (
                <FinanceClaimRow
                  key={item.claim.id}
                  item={item}
                  checked={selectedSet.has(item.claim.id)}
                  disabled={isSubmitting && processingClaimId === item.claim.id}
                  selectable={selectableClaimIds.includes(item.claim.id)}
                  isProcessingRow={processingClaimId === item.claim.id}
                  onToggle={toggleClaim}
                  onRunAction={handleSingleAction}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
