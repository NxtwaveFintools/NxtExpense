import Link from 'next/link'
import { Loader2 } from 'lucide-react'

import {
  DATA_TABLE_ROW_CLASS,
  getDataTableCellClass,
} from '@/components/ui/data-table-tokens'
import { formatDate } from '@/lib/utils/date'

import type { ClaimAvailableAction } from '@/features/claims/types'
import type { FinanceActionType } from '@/features/finance/types'
import type { FinanceQueueItem } from '@/features/finance/types'

type FinanceClaimRowProps = {
  item: FinanceQueueItem
  checked: boolean
  disabled: boolean
  selectable: boolean
  isProcessingRow: boolean
  onToggle: (claimId: string, checked: boolean) => void
  onRunAction: (claimId: string, action: ClaimAvailableAction) => void
}

export function FinanceClaimRow({
  item,
  checked,
  disabled,
  isProcessingRow,
  selectable,
  onToggle,
  onRunAction,
}: FinanceClaimRowProps) {
  return (
    <tr className={DATA_TABLE_ROW_CLASS}>
      <td className={getDataTableCellClass()}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled || !selectable}
          onChange={(event) => onToggle(item.claim.id, event.target.checked)}
          className="size-4 rounded border-border accent-primary"
        />
      </td>
      <td className={getDataTableCellClass({ weight: 'medium', nowrap: true })}>
        <Link
          href={`/claims/${item.claim.id}?from=finance`}
          className="text-primary font-semibold hover:text-primary-hover transition-colors"
        >
          {item.claim.claim_number}
        </Link>
      </td>
      <td className={getDataTableCellClass({ muted: true, nowrap: true })}>
        {item.owner.employee_name}
      </td>
      <td className={getDataTableCellClass({ muted: true, nowrap: true })}>
        {formatDate(item.claim.claim_date)}
      </td>
      <td className={getDataTableCellClass({ muted: true, nowrap: true })}>
        {item.claim.work_location}
      </td>
      <td className={getDataTableCellClass()}>
        <div className="flex items-center justify-between gap-3">
          <span className="whitespace-nowrap font-mono font-medium">
            Rs. {Number(item.claim.total_amount).toFixed(2)}
          </span>
          <div className="flex flex-wrap justify-end gap-1.5">
            {item.availableActions
              .filter(
                (
                  action
                ): action is ClaimAvailableAction & {
                  action: FinanceActionType
                } =>
                  action.action === 'issued' ||
                  action.action === 'finance_rejected'
              )
              .map((action) => (
                <button
                  key={`${item.claim.id}-${action.action}-${action.display_label}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => onRunAction(item.claim.id, action)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${
                    action.action === 'issued'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-rose-600 text-white hover:bg-rose-700'
                  }`}
                >
                  {isProcessingRow ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : null}
                  {isProcessingRow ? 'Processing...' : action.display_label}
                </button>
              ))}
          </div>
        </div>
      </td>
    </tr>
  )
}
