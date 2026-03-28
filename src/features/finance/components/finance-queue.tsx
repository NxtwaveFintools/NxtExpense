'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import type { PaginatedFinanceQueue } from '@/features/finance/types'
import { bulkFinanceClaimsAction } from '@/features/finance/actions'
import {
  buildFinanceActionIntents,
  getFinanceActionToneClass,
  getFinanceSuccessLabel,
  sortFinanceActionIntents,
  supportsFinanceIntent,
  type FinanceActionIntent,
} from '@/features/finance/utils/action-intents'
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
    pageSize: number
    totalPages?: number
    totalItems?: number
  }
}

export function FinanceQueue({ queue, pagination }: FinanceQueueProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [processingAction, setProcessingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectableClaimIds = useMemo(
    () =>
      queue.data
        .filter((item) => item.availableActions.length > 0)
        .map((item) => item.claim.id),
    [queue.data]
  )

  const bulkActionIntents = useMemo(() => {
    const selectedSet = new Set(selectedIds)
    const selectedItems = queue.data.filter((item) =>
      selectedSet.has(item.claim.id)
    )
    const sourceItems = selectedItems.length > 0 ? selectedItems : queue.data
    const intents = new Map<string, FinanceActionIntent>()

    for (const item of sourceItems) {
      for (const action of item.availableActions) {
        for (const intent of buildFinanceActionIntents(action)) {
          if (!intents.has(intent.key)) {
            intents.set(intent.key, intent)
          }
        }
      }
    }

    return sortFinanceActionIntents(Array.from(intents.values()))
  }, [queue.data, selectedIds])

  const bulkActionIntentMap = useMemo(
    () => new Map(bulkActionIntents.map((intent) => [intent.key, intent])),
    [bulkActionIntents]
  )

  const allSelected =
    selectableClaimIds.length > 0 &&
    selectedIds.length === selectableClaimIds.length
  const partiallySelected = selectedIds.length > 0 && !allSelected

  function toggleClaim(claimId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        if (current.includes(claimId)) {
          return current
        }
        return [...current, claimId]
      }
      return current.filter((id) => id !== claimId)
    })
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? selectableClaimIds : [])
  }

  async function handleBulkAction(intent: FinanceActionIntent) {
    if (selectedIds.length === 0) {
      return
    }

    const selectedSet = new Set(selectedIds)
    const selectedItems = queue.data.filter((item) =>
      selectedSet.has(item.claim.id)
    )
    const eligibleIds = selectedItems
      .filter((item) => supportsFinanceIntent(item, intent))
      .map((item) => item.claim.id)

    if (eligibleIds.length === 0) {
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

    setIsSubmitting(true)
    setProcessingAction(intent.key)
    setError(null)

    try {
      const result = await bulkFinanceClaimsAction({
        claimIds: eligibleIds,
        action: intent.actionCode,
        notes,
        allowResubmit: intent.allowResubmit ? true : undefined,
      })

      if (!result.ok) {
        setError(result.error)
        toast.error(result.error ?? 'Unable to process selected claims.')
        return
      }

      toast.success(getFinanceSuccessLabel(intent, eligibleIds.length))
      setSelectedIds([])
      router.refresh()
    } catch {
      const message = 'Unexpected error while processing selected claims.'
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
      setProcessingAction(null)
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
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
      />

      {error ? (
        <p className="mt-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <label className="mt-3 block space-y-2 text-sm">
        <span className="text-foreground/80">
          Notes for the selected workflow action
        </span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>

      <p className="mt-2 text-xs text-muted-foreground">
        Select one or more claims, then use the top action buttons.
      </p>

      <div className="mt-4">
        <FinanceQueueToolbar
          selectedCount={selectedIds.length}
          allSelected={allSelected}
          partiallySelected={partiallySelected}
          totalCount={selectableClaimIds.length}
          bulkActions={bulkActionIntents.map((intent) => ({
            key: intent.key,
            label: intent.label,
            toneClass: getFinanceActionToneClass(intent),
          }))}
          onToggleSelectAll={toggleSelectAll}
          onRunBulkAction={(actionKey) => {
            const intent = bulkActionIntentMap.get(actionKey)
            if (!intent) {
              toast.error('Selected workflow action is unavailable.')
              return
            }

            void handleBulkAction(intent)
          }}
          disabled={isSubmitting}
          processingAction={processingAction}
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
                  disabled={isSubmitting}
                  selectable={selectableClaimIds.includes(item.claim.id)}
                  onToggle={toggleClaim}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
