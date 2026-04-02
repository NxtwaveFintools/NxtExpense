import Link from 'next/link'
import { FileText, Plus } from 'lucide-react'

import type { PaginatedClaims } from '@/features/claims/types'
import { ClaimStatusBadge } from '@/features/claims/components/claim-status-badge'
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
import { formatDate, formatDatetime } from '@/lib/utils/date'
import { getCursorPageStartIndex } from '@/lib/utils/pagination'

type ClaimListPagination = {
  backHref: string | null
  nextHref: string | null
  pageNumber: number
  pageSize: number
  totalPages?: number
  totalItems?: number
}

type ClaimListProps = {
  claims: PaginatedClaims
  pagination: ClaimListPagination
}

export function ClaimList({ claims, pagination }: ClaimListProps) {
  const pageStartIndex = getCursorPageStartIndex(
    pagination.pageNumber,
    pagination.pageSize
  )

  if (claims.data.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-8 shadow-sm text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
          <FileText className="size-6 text-primary" />
        </div>
        <h2 className="font-display text-lg font-semibold">My Claims</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
          No claims yet. Create your first claim to begin the workflow.
        </p>
        <Link
          href="/claims/new"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover hover:shadow-md active:scale-[0.98]"
        >
          <Plus className="size-4" />
          New Claim
        </Link>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-surface shadow-sm">
      <div
        className={`${DATA_TABLE_HEADER_BAR_CLASS} flex items-center justify-between`}
      >
        <h2 className="font-display text-lg font-semibold">My Claims</h2>
        <Link
          href="/claims/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover hover:shadow-md active:scale-[0.98]"
        >
          <Plus className="size-3.5" />
          New Claim
        </Link>
      </div>

      <div className={DATA_TABLE_PAGINATION_SLOT_CLASS}>
        <CursorPaginationControls
          backHref={pagination.backHref}
          nextHref={pagination.nextHref}
          pageNumber={pagination.pageNumber}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
        />
      </div>

      <div className={DATA_TABLE_SCROLL_WRAPPER_CLASS}>
        <table className={`${DATA_TABLE_CLASS} min-w-230`}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th
                className={getDataTableHeadCellClass({
                  weight: 'semibold',
                  nowrap: true,
                })}
              >
                #
              </th>
              <th
                className={getDataTableHeadCellClass({
                  nowrap: true,
                  weight: 'semibold',
                })}
              >
                Claim ID
              </th>
              <th
                className={getDataTableHeadCellClass({
                  weight: 'semibold',
                })}
              >
                Travel Date
              </th>
              <th
                className={getDataTableHeadCellClass({
                  weight: 'semibold',
                })}
              >
                Location
              </th>
              <th
                className={getDataTableHeadCellClass({
                  weight: 'semibold',
                })}
              >
                Amount
              </th>
              <th
                className={getDataTableHeadCellClass({
                  weight: 'semibold',
                })}
              >
                Status
              </th>
              <th
                className={getDataTableHeadCellClass({
                  weight: 'semibold',
                })}
              >
                Submitted At
              </th>
            </tr>
          </thead>
          <tbody className={DATA_TABLE_BODY_CLASS}>
            {claims.data.map((claim, index) => (
              <tr key={claim.id} className={DATA_TABLE_ROW_CLASS}>
                <td
                  className={getDataTableCellClass({
                    mono: true,
                    muted: true,
                    nowrap: true,
                  })}
                >
                  {pageStartIndex + index}
                </td>
                <td
                  className={getDataTableCellClass({
                    weight: 'medium',
                    nowrap: true,
                  })}
                >
                  <Link
                    href={`/claims/${claim.id}`}
                    className="text-primary font-semibold hover:text-primary-hover transition-colors"
                  >
                    {claim.claim_number}
                  </Link>
                </td>
                <td
                  className={getDataTableCellClass({
                    muted: true,
                    nowrap: true,
                  })}
                >
                  {formatDate(claim.claim_date)}
                </td>
                <td
                  className={getDataTableCellClass({
                    muted: true,
                    nowrap: true,
                  })}
                >
                  {claim.work_location}
                </td>
                <td
                  className={getDataTableCellClass({
                    mono: true,
                    weight: 'medium',
                    nowrap: true,
                  })}
                >
                  Rs. {Number(claim.total_amount).toFixed(2)}
                </td>
                <td className={getDataTableCellClass()}>
                  <ClaimStatusBadge
                    statusName={claim.statusName}
                    statusDisplayColor={claim.statusDisplayColor}
                  />
                </td>
                <td
                  className={getDataTableCellClass({
                    muted: true,
                    nowrap: true,
                  })}
                >
                  {claim.submitted_at
                    ? formatDatetime(claim.submitted_at)
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
