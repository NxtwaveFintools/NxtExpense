'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { formatDate, formatDatetime } from '@/lib/utils/date'
import { CursorPaginationControls } from '@/components/ui/cursor-pagination-controls'
import { bulkFinanceClaimsAction } from '@/features/finance/actions'
import {
  buildFinanceActionIntents,
  getFinanceActionToneClass,
  getFinanceSuccessLabel,
  sortFinanceActionIntents,
  supportsFinanceIntent,
  type FinanceActionIntent,
} from '@/features/finance/utils/action-intents'
import { FinanceQueueToolbar } from '@/features/finance/components/finance-queue-toolbar'
import {
  DATA_TABLE_BODY_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_HEADER_BAR_CLASS,
  DATA_TABLE_PAGINATION_SLOT_CLASS,
  DATA_TABLE_ROW_CLASS,
  DATA_TABLE_SCROLL_WRAPPER_CLASS,
  getDataTableCellClass,
  getDataTableHeadCellClass,
} from '@/components/ui/data-table-tokens'

import { getFinanceHistoryAction } from '@/features/finance/actions'
import { ClaimStatusBadge } from '@/features/claims/components/claim-status-badge'

type FinanceHistoryPayload = Awaited<ReturnType<typeof getFinanceHistoryAction>>

type FinanceHistoryListProps = {
  history: FinanceHistoryPayload
  source?: 'finance' | 'approved-history'
  pagination: {
    backHref: string | null
    nextHref: string | null
    pageNumber: number
    pageSize: number
    totalPages?: number
    totalItems?: number
  }
}

export function FinanceHistoryList({
  history,
  source = 'finance',
  pagination,
}: FinanceHistoryListProps) {
  const router = useRouter()
  const enableBulkActions = source === 'approved-history'
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [processingAction, setProcessingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedRowIdSet = useMemo(
    () => new Set(selectedRowIds),
    [selectedRowIds]
  )

  const selectableRowIds = useMemo(() => {
    if (!enableBulkActions) {
      return []
    }

    return history.data
      .filter((row) => row.availableActions.length > 0)
      .map((row) => row.action.id)
  }, [enableBulkActions, history.data])

  const bulkActionIntents = useMemo(() => {
    if (!enableBulkActions) {
      return []
    }

    const selectedSet = new Set(selectedRowIds)
    const selectedRows = history.data.filter((row) =>
      selectedSet.has(row.action.id)
    )
    const sourceRows = selectedRows.length > 0 ? selectedRows : history.data
    const intents = new Map<string, FinanceActionIntent>()

    for (const row of sourceRows) {
      for (const action of row.availableActions) {
        for (const intent of buildFinanceActionIntents(action)) {
          if (!intents.has(intent.key)) {
            intents.set(intent.key, intent)
          }
        }
      }
    }

    return sortFinanceActionIntents(Array.from(intents.values()))
  }, [enableBulkActions, history.data, selectedRowIds])

  const bulkActionIntentMap = useMemo(
    () => new Map(bulkActionIntents.map((intent) => [intent.key, intent])),
    [bulkActionIntents]
  )

  const allSelected =
    selectableRowIds.length > 0 &&
    selectedRowIds.length === selectableRowIds.length
  const partiallySelected = selectedRowIds.length > 0 && !allSelected

  function toggleRow(rowId: string, checked: boolean) {
    setSelectedRowIds((current) => {
      if (checked) {
        if (current.includes(rowId)) {
          return current
        }

        return [...current, rowId]
      }

      return current.filter((id) => id !== rowId)
    })
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedRowIds(checked ? selectableRowIds : [])
  }

  async function handleBulkAction(intent: FinanceActionIntent) {
    if (selectedRowIds.length === 0) {
      return
    }

    const selectedSet = new Set(selectedRowIds)
    const selectedRows = history.data.filter((row) =>
      selectedSet.has(row.action.id)
    )
    const selectedClaimIds = [
      ...new Set(selectedRows.map((row) => row.claim.id)),
    ]
    const eligibleClaimIds = [
      ...new Set(
        selectedRows
          .filter((row) =>
            supportsFinanceIntent(
              {
                availableActions: row.availableActions,
              },
              intent
            )
          )
          .map((row) => row.claim.id)
      ),
    ]

    if (eligibleClaimIds.length === 0) {
      toast.info('Selected rows do not support this workflow action.')
      return
    }

    if (eligibleClaimIds.length < selectedClaimIds.length) {
      toast.info(
        'Some selected rows do not support this action and were skipped.'
      )
    }

    setIsSubmitting(true)
    setProcessingAction(intent.key)
    setError(null)

    try {
      const result = await bulkFinanceClaimsAction({
        claimIds: eligibleClaimIds,
        action: intent.actionCode,
        notes,
        allowResubmit: intent.allowResubmit ? true : undefined,
      })

      if (!result.ok) {
        setError(result.error)
        toast.error(result.error ?? 'Unable to process selected claims.')
        return
      }

      toast.success(getFinanceSuccessLabel(intent, eligibleClaimIds.length))
      setSelectedRowIds([])
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

  if (history.data.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-surface p-8 text-center">
        <h2 className="text-lg font-semibold">Approved History</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No history claims found.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className={DATA_TABLE_HEADER_BAR_CLASS}>
        <h2 className="text-lg font-semibold">Approved History</h2>
      </div>

      <div className={DATA_TABLE_PAGINATION_SLOT_CLASS}>
        <CursorPaginationControls
          backHref={pagination.backHref}
          nextHref={pagination.nextHref}
          pageNumber={pagination.pageNumber}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
        />
      </div>

      {enableBulkActions ? (
        <div className="border-b border-border px-6 pb-4">
          {error ? (
            <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
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
            Select one or more rows and run Release Payment from this list.
          </p>

          <div className="mt-3">
            <FinanceQueueToolbar
              selectedCount={selectedRowIds.length}
              allSelected={allSelected}
              partiallySelected={partiallySelected}
              totalCount={selectableRowIds.length}
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
          </div>
        </div>
      ) : null}

      <div className={DATA_TABLE_SCROLL_WRAPPER_CLASS}>
        <table className={`${DATA_TABLE_CLASS} min-w-230`}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              {enableBulkActions ? (
                <th className={getDataTableHeadCellClass({ nowrap: true })}>
                  Select
                </th>
              ) : null}
              <th className={getDataTableHeadCellClass({ nowrap: true })}>
                Claim ID
              </th>
              <th className={getDataTableHeadCellClass({ nowrap: true })}>
                Emp ID
              </th>
              <th className={getDataTableHeadCellClass()}>Employee</th>
              <th className={getDataTableHeadCellClass()}>Travel Date</th>
              <th className={getDataTableHeadCellClass()}>Location</th>
              <th className={getDataTableHeadCellClass()}>Amount</th>
              <th className={getDataTableHeadCellClass()}>Processed On</th>
              <th className={getDataTableHeadCellClass()}>Current Status</th>
            </tr>
          </thead>
          <tbody className={DATA_TABLE_BODY_CLASS}>
            {history.data.map((row) => (
              <tr
                key={row.action.id}
                className={DATA_TABLE_ROW_CLASS}
                data-testid="finance-history-row"
              >
                {enableBulkActions ? (
                  <td className={getDataTableCellClass({ nowrap: true })}>
                    <input
                      type="checkbox"
                      checked={selectedRowIdSet.has(row.action.id)}
                      disabled={
                        isSubmitting || row.availableActions.length === 0
                      }
                      onChange={(event) =>
                        toggleRow(row.action.id, event.target.checked)
                      }
                      className="size-4 rounded border-border accent-primary"
                    />
                  </td>
                ) : null}
                <td
                  className={getDataTableCellClass({
                    weight: 'medium',
                    nowrap: true,
                  })}
                >
                  <Link
                    href={`/claims/${row.claim.id}?from=${source}`}
                    className="text-primary font-semibold hover:text-primary-hover transition-colors"
                  >
                    {row.claim.claim_number}
                  </Link>
                </td>
                <td
                  className={getDataTableCellClass({
                    muted: true,
                    nowrap: true,
                  })}
                >
                  {row.owner.employee_id}
                </td>
                <td
                  className={getDataTableCellClass({
                    muted: true,
                    nowrap: true,
                  })}
                >
                  {row.owner.employee_name}
                </td>
                <td
                  className={getDataTableCellClass({
                    muted: true,
                    nowrap: true,
                  })}
                >
                  {formatDate(row.claim.claim_date)}
                </td>
                <td
                  className={getDataTableCellClass({
                    muted: true,
                    nowrap: true,
                  })}
                >
                  {row.claim.work_location}
                </td>
                <td
                  className={getDataTableCellClass({
                    mono: true,
                    weight: 'medium',
                    nowrap: true,
                  })}
                >
                  Rs. {Number(row.claim.total_amount).toFixed(2)}
                </td>
                <td
                  className={getDataTableCellClass({
                    muted: true,
                    nowrap: true,
                  })}
                >
                  {formatDatetime(row.action.acted_at)}
                </td>
                <td className={getDataTableCellClass()}>
                  <ClaimStatusBadge
                    statusName={row.claim.statusName}
                    statusDisplayColor={row.claim.statusDisplayColor}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
