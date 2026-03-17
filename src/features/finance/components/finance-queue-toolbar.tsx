'use client'

import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'

import type { FinanceActionType } from '@/features/finance/types'

type FinanceActionIntent = FinanceActionType | 'finance_rejected_allow_reclaim'

type FinanceQueueToolbarProps = {
  selectedCount: number
  allSelected: boolean
  partiallySelected: boolean
  totalCount: number
  canRejectAllowReclaim: boolean
  onToggleSelectAll: (checked: boolean) => void
  onIssueSelected: () => void
  onRejectSelected: () => void
  onRejectAllowReclaimSelected: () => void
  disabled: boolean
  processingAction: FinanceActionIntent | null
}

export function FinanceQueueToolbar({
  selectedCount,
  allSelected,
  partiallySelected,
  totalCount,
  canRejectAllowReclaim,
  onToggleSelectAll,
  onIssueSelected,
  onRejectSelected,
  onRejectAllowReclaimSelected,
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
          <button
            type="button"
            onClick={onIssueSelected}
            disabled={disabled || selectedCount === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
          >
            {processingAction === 'issued' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            {processingAction === 'issued'
              ? 'Processing...'
              : 'Issue Payment Selected'}
          </button>

          <button
            type="button"
            onClick={onRejectSelected}
            disabled={disabled || selectedCount === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-rose-700 disabled:opacity-50"
          >
            {processingAction === 'finance_rejected' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            {processingAction === 'finance_rejected'
              ? 'Processing...'
              : 'Reject Selected'}
          </button>

          {canRejectAllowReclaim ? (
            <button
              type="button"
              onClick={onRejectAllowReclaimSelected}
              disabled={disabled || selectedCount === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-amber-700 disabled:opacity-50"
            >
              {processingAction === 'finance_rejected_allow_reclaim' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              {processingAction === 'finance_rejected_allow_reclaim'
                ? 'Processing...'
                : 'Reject & Allow Reclaim'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
