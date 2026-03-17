'use client'

import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'

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
    <div className="border-b border-border bg-muted/30 px-6 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allSelected}
            disabled={disabled || totalCount === 0}
            onChange={(event) => onToggleSelectAll(event.target.checked)}
            className="size-4 rounded border-border accent-primary"
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
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-all disabled:opacity-50 ${
                bulkAction.action === 'issued'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-rose-600 text-white hover:bg-rose-700'
              }`}
            >
              {processingAction === bulkAction.action ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              {processingAction === bulkAction.action
                ? 'Processing...'
                : bulkAction.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
