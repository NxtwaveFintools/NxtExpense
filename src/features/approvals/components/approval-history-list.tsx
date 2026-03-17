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
import { ClaimStatusBadge } from '@/features/claims/components/claim-status-badge'

import type {
  ApprovalHistoryRecord,
  PaginatedApprovalHistoryRecords,
} from '@/features/approvals/types'

type ApprovalHistoryListProps = {
  history: PaginatedApprovalHistoryRecords
  pagination: {
    backHref: string | null
    nextHref: string | null
    pageNumber: number
  }
  showAmountColumn?: boolean
}

export function ApprovalHistoryList({
  history,
  pagination,
  showAmountColumn = true,
}: ApprovalHistoryListProps) {
  if (history.data.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-surface p-8 text-center">
        <h2 className="text-lg font-semibold">Approval History</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No past approvals found.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className={DATA_TABLE_HEADER_BAR_CLASS}>
        <h2 className="text-lg font-semibold">Approval History</h2>
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
              {showAmountColumn ? (
                <th className={getDataTableHeadCellClass()}>Amount</th>
              ) : null}
              <th className={getDataTableHeadCellClass()}>HOD Approved</th>
              <th className={getDataTableHeadCellClass()}>Finance Date</th>
              <th className={getDataTableHeadCellClass()}>Status</th>
            </tr>
          </thead>
          <tbody className={DATA_TABLE_BODY_CLASS}>
            {history.data.map((row: ApprovalHistoryRecord) => (
              <tr key={row.actionId} className={DATA_TABLE_ROW_CLASS}>
                <td
                  className={getDataTableCellClass({
                    weight: 'medium',
                    nowrap: true,
                  })}
                >
                  <Link
                    href={`/claims/${row.claimId}?from=approvals`}
                    className="text-primary font-semibold hover:text-primary-hover transition-colors"
                  >
                    {row.claimNumber}
                  </Link>
                </td>
                <td
                  className={getDataTableCellClass({
                    muted: true,
                    nowrap: true,
                  })}
                >
                  {row.ownerName}
                </td>
                <td
                  className={getDataTableCellClass({
                    muted: true,
                    nowrap: true,
                  })}
                >
                  {formatDate(row.claimDate)}
                </td>
                {showAmountColumn ? (
                  <td
                    className={getDataTableCellClass({
                      mono: true,
                      weight: 'medium',
                      nowrap: true,
                    })}
                  >
                    Rs. {row.totalAmount.toFixed(2)}
                  </td>
                ) : null}
                <td
                  className={getDataTableCellClass({
                    muted: true,
                    nowrap: true,
                  })}
                >
                  {row.hodApprovedAt ? formatDatetime(row.hodApprovedAt) : '-'}
                </td>
                <td
                  className={getDataTableCellClass({
                    muted: true,
                    nowrap: true,
                  })}
                >
                  {row.financeApprovedAt
                    ? formatDatetime(row.financeApprovedAt)
                    : '-'}
                </td>
                <td className={getDataTableCellClass()}>
                  <ClaimStatusBadge
                    statusName={row.claimStatusName}
                    statusDisplayColor={row.claimStatusDisplayColor}
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
