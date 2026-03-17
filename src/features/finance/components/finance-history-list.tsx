import Link from 'next/link'

import { formatDate, formatDatetime } from '@/lib/utils/date'
import { CursorPaginationControls } from '@/components/ui/cursor-pagination-controls'
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
  pagination: {
    backHref: string | null
    nextHref: string | null
    pageNumber: number
  }
}

export function FinanceHistoryList({
  history,
  pagination,
}: FinanceHistoryListProps) {
  if (history.data.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-surface p-8 text-center">
        <h2 className="text-lg font-semibold">Finance History</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No past finance actions found.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className={DATA_TABLE_HEADER_BAR_CLASS}>
        <h2 className="text-lg font-semibold">Finance History</h2>
      </div>

      <div className={DATA_TABLE_PAGINATION_SLOT_CLASS}>
        <CursorPaginationControls
          backHref={pagination.backHref}
          nextHref={pagination.nextHref}
          pageNumber={pagination.pageNumber}
        />
      </div>

      <div className={DATA_TABLE_SCROLL_WRAPPER_CLASS}>
        <table className={`${DATA_TABLE_CLASS} min-w-210`}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={getDataTableHeadCellClass({ nowrap: true })}>
                Claim ID
              </th>
              <th className={getDataTableHeadCellClass()}>Employee</th>
              <th className={getDataTableHeadCellClass()}>Claim Date</th>
              <th className={getDataTableHeadCellClass()}>Location</th>
              <th className={getDataTableHeadCellClass()}>Amount</th>
              <th className={getDataTableHeadCellClass()}>Processed On</th>
              <th className={getDataTableHeadCellClass()}>Current Status</th>
            </tr>
          </thead>
          <tbody className={DATA_TABLE_BODY_CLASS}>
            {history.data.map((row) => (
              <tr key={row.action.id} className={DATA_TABLE_ROW_CLASS}>
                <td
                  className={getDataTableCellClass({
                    weight: 'medium',
                    nowrap: true,
                  })}
                >
                  <Link
                    href={`/claims/${row.claim.id}?from=finance`}
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
