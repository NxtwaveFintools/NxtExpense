'use client'

import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'

type FinanceBulkActionOption = {
  key: string
  label: string
}

type FinanceQueueToolbarProps = {
  selectedCount: number
  allSelected: boolean
  partiallySelected: boolean
  totalCount: number
  bulkActions: FinanceBulkActionOption[]
  onToggleSelectAll: (checked: boolean) => void
  onRunBulkAction: (actionKey: string) => void
  disabled: boolean
  processingAction: string | null
}

const TOOLBAR_ACTION_BUTTON_CLASSES = [
  'bg-emerald-600 hover:bg-emerald-700',
  'bg-rose-600 hover:bg-rose-700',
  'bg-amber-600 hover:bg-amber-700',
  'bg-sky-600 hover:bg-sky-700',
] as const

export function FinanceQueueToolbar({
  selectedCount,
  allSelected,
  partiallySelected,
  totalCount,
  bulkActions,
  onToggleSelectAll,
  onRunBulkAction,
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
          {bulkActions.map((action, index) => {
            const toneClass =
              TOOLBAR_ACTION_BUTTON_CLASSES[
                index % TOOLBAR_ACTION_BUTTON_CLASSES.length
              ]

            return (
              <button
                key={action.key}
                type="button"
                onClick={() => onRunBulkAction(action.key)}
                disabled={disabled || selectedCount === 0}
                className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold text-white transition-all disabled:opacity-50 ${toneClass}`}
              >
                {processingAction === action.key ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                {processingAction === action.key
                  ? 'Processing...'
                  : action.label}
              </button>
            )
          })}

          {bulkActions.length === 0 ? (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3.5 py-2 text-xs font-semibold text-muted-foreground"
            >
              No actions available
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
