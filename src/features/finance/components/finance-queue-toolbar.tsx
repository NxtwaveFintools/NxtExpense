'use client'

import { useEffect, useRef } from 'react'

import type { FinanceActionType } from '@/features/finance/types'

type BulkAction = {
  action: FinanceActionType
  label: string
}

type FinanceQueueToolbarProps = {
  selectedCount: number
  allSelected: boolean
  partiallySelected: boolean
  totalCount: number
  bulkActions: BulkAction[]
  onToggleSelectAll: (checked: boolean) => void
  onBulkAction: (action: BulkAction['action']) => void
  disabled: boolean
  processingAction: BulkAction['action'] | null
}

export function FinanceQueueToolbar({
  selectedCount,
  allSelected,
  partiallySelected,
  totalCount,
  bulkActions,
  onToggleSelectAll,
  onBulkAction,
  disabled,
  processingAction,
}: FinanceQueueToolbarProps) {
  const selectAllRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!selectAllRef.current) {
      return
    }

    selectAllRef.current.indeterminate = partiallySelected
  }, [partiallySelected])

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
      <label className="inline-flex items-center gap-2 text-xs text-foreground/70">
        <input
          ref={selectAllRef}
          type="checkbox"
          checked={allSelected}
          disabled={disabled || totalCount === 0}
          onChange={(event) => onToggleSelectAll(event.target.checked)}
        />
        Select all ({selectedCount}/{totalCount})
      </label>

      <div className="flex items-center gap-2">
        {bulkActions.map((bulkAction) => (
          <button
            key={bulkAction.action}
            type="button"
            onClick={() => onBulkAction(bulkAction.action)}
            disabled={disabled || selectedCount === 0}
            className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-60"
          >
            {processingAction === bulkAction.action
              ? 'Processing...'
              : bulkAction.label}
          </button>
        ))}
      </div>
    </div>
  )
}
