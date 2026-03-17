import { Loader2 } from 'lucide-react'

type ApprovalListToolbarProps = {
  allSelected: boolean
  selectedCount: number
  selectableCount: number
  notes: string
  allowResubmit: boolean
  isProcessing: boolean
  processingAction: string | null
  onToggleSelectAll: (checked: boolean) => void
  onNotesChange: (value: string) => void
  onAllowResubmitChange: (checked: boolean) => void
  onApproveSelected: () => void
  onRejectSelected: () => void
}

export function ApprovalListToolbar({
  allSelected,
  selectedCount,
  selectableCount,
  notes,
  allowResubmit,
  isProcessing,
  processingAction,
  onToggleSelectAll,
  onNotesChange,
  onAllowResubmitChange,
  onApproveSelected,
  onRejectSelected,
}: ApprovalListToolbarProps) {
  return (
    <div className="border-b border-border bg-muted/30 px-6 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={allSelected}
            disabled={isProcessing || selectableCount === 0}
            onChange={(event) => onToggleSelectAll(event.target.checked)}
            className="size-4 rounded border-border accent-primary"
          />
          {selectedCount}/{selectableCount} selected
        </label>

        <textarea
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Approval notes (optional)..."
          className="min-h-9 w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-xs transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          rows={1}
        />

        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={allowResubmit}
            onChange={(event) => onAllowResubmitChange(event.target.checked)}
            className="size-3.5 rounded border-border accent-primary"
          />
          Allow resubmit on reject
        </label>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onApproveSelected}
            disabled={isProcessing || selectedCount === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
          >
            {isProcessing && processingAction === 'approved' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Approve Selected
          </button>
          <button
            type="button"
            onClick={onRejectSelected}
            disabled={isProcessing || selectedCount === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-rose-700 disabled:opacity-50"
          >
            {isProcessing && processingAction === 'rejected' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Reject Selected
          </button>
        </div>
      </div>
    </div>
  )
}
