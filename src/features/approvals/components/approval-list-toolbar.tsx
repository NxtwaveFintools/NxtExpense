import { Loader2 } from 'lucide-react'

type BulkApprovalActionOption = {
  key: string
  label: string
}

type ApprovalListToolbarProps = {
  allSelected: boolean
  selectedCount: number
  selectableCount: number
  notes: string
  isProcessing: boolean
  processingAction: string | null
  bulkActions: BulkApprovalActionOption[]
  onToggleSelectAll: (checked: boolean) => void
  onNotesChange: (value: string) => void
  onRunBulkAction: (actionKey: string) => void
}

const BULK_ACTION_BUTTON_CLASSES = [
  'bg-emerald-600 hover:bg-emerald-700',
  'bg-rose-600 hover:bg-rose-700',
  'bg-amber-600 hover:bg-amber-700',
  'bg-sky-600 hover:bg-sky-700',
] as const

export function ApprovalListToolbar({
  allSelected,
  selectedCount,
  selectableCount,
  notes,
  isProcessing,
  processingAction,
  bulkActions,
  onToggleSelectAll,
  onNotesChange,
  onRunBulkAction,
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
          placeholder="Notes for the selected workflow action..."
          className="min-h-9 w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-xs transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          rows={1}
        />

        <div className="ml-auto flex items-center gap-2">
          {bulkActions.map((action, index) => {
            const toneClass =
              BULK_ACTION_BUTTON_CLASSES[
                index % BULK_ACTION_BUTTON_CLASSES.length
              ]

            return (
              <button
                key={action.key}
                type="button"
                onClick={() => onRunBulkAction(action.key)}
                disabled={isProcessing || selectedCount === 0}
                className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold text-white transition-all disabled:opacity-50 ${toneClass}`}
              >
                {isProcessing && processingAction === action.key ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                {action.label}
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
