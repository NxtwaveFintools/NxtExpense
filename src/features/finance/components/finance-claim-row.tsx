import Link from 'next/link'

import {
  DATA_TABLE_ROW_CLASS,
  getDataTableCellClass,
} from '@/components/ui/data-table-tokens'
import { formatDate } from '@/lib/utils/date'

import type { FinanceQueueItem } from '@/features/finance/types'

type FinanceClaimRowProps = {
  item: FinanceQueueItem
  checked: boolean
  disabled: boolean
  selectable: boolean
  onToggle: (claimId: string, checked: boolean) => void
}

export function FinanceClaimRow({
  item,
  checked,
  disabled,
  selectable,
  onToggle,
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
      <td className={getDataTableCellClass({ mono: true, weight: 'medium' })}>
        Rs. {Number(item.claim.total_amount).toFixed(2)}
      </td>
    </tr>
  )
}
