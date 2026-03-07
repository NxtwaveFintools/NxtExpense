'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import type { ClaimAvailableAction } from '@/features/claims/types'
import {
  bulkFinanceClaimsAction,
  submitFinanceAction,
} from '@/features/finance/actions'
import { CursorPaginationControls } from '@/components/ui/cursor-pagination-controls'
import { FinanceClaimRow } from '@/features/finance/components/finance-claim-row'
import { FinanceQueueToolbar } from '@/features/finance/components/finance-queue-toolbar'
import type { PaginatedFinanceQueue } from '@/features/finance/types'

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
    const actions = new Map<'issued' | 'finance_rejected', string>()

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

  async function handleBulkAction(action: 'issued' | 'finance_rejected') {
    if (selectedIds.length === 0) {
      return
    }

    setIsSubmitting(true)
    setProcessingClaimId(null)
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
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Finance Queue</h2>
        <p className="mt-2 text-sm text-foreground/70">
          No claims are waiting for finance action.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
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

      <label className="mt-3 inline-flex items-center gap-2 text-sm text-foreground/80">
        <input
          type="checkbox"
          checked={allowResubmit}
          onChange={(event) => setAllowResubmit(event.target.checked)}
        />
        For rejection, return claim to employee for modification
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
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-215 border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-foreground/70">
                <th className="px-3 py-2 font-medium">Select</th>
                <th className="px-3 py-2 font-medium">Claim ID</th>
                <th className="px-3 py-2 font-medium">Employee</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {queue.data.map((item) => (
                <FinanceClaimRow
                  key={item.claim.id}
                  item={item}
                  checked={selectedSet.has(item.claim.id)}
                  disabled={isSubmitting}
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
