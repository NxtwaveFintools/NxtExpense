'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

import {
  DATA_TABLE_BODY_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_HEADER_BAR_CLASS,
  DATA_TABLE_PAGINATION_SLOT_CLASS,
  DATA_TABLE_ROW_CLASS,
  DATA_TABLE_SCROLL_WRAPPER_CLASS,
  DATA_TABLE_SECTION_CLASS,
  getDataTableCellClass,
  getDataTableHeadCellClass,
} from '@/components/ui/data-table-tokens'
import type { AdminAnalyticsClaimsPage } from '@/features/admin/types/analytics'
import { formatDate, formatDatetime } from '@/lib/utils/date'

type AdminAnalyticsClaimsTableProps = {
  claimsPage: AdminAnalyticsClaimsPage | null
  isLoading: boolean
  hasPreviousPage: boolean
  currentPage: number
  pageSize: number
  pageSizeOptions: number[]
  onPageSizeChange: (value: number) => void
  onPreviousPage: () => void
  onNextPage: (nextCursor: string) => void
}

function ClaimsTableSkeleton() {
  return (
    <div className="mx-6 mb-6 space-y-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-10 rounded-lg" />
      ))}
    </div>
  )
}

const PAGINATION_BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50'

export function AdminAnalyticsClaimsTable({
  claimsPage,
  isLoading,
  hasPreviousPage,
  currentPage,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  onPreviousPage,
  onNextPage,
}: AdminAnalyticsClaimsTableProps) {
  const claims = claimsPage?.data ?? []
  const hasNextPage = Boolean(claimsPage?.hasNextPage && claimsPage?.nextCursor)

  return (
    <section className={`${DATA_TABLE_SECTION_CLASS} shadow-sm`}>
      <div className={DATA_TABLE_HEADER_BAR_CLASS}>
        <div>
          <h3 className="text-sm font-semibold text-foreground">All Claims</h3>
          <p className="text-xs text-muted-foreground">
            Submitted date descending, all statuses.
          </p>
        </div>
      </div>

      <div className={DATA_TABLE_PAGINATION_SLOT_CLASS}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              Rows
            </label>
            <select
              value={String(pageSize)}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              Page {currentPage}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPreviousPage}
              disabled={!hasPreviousPage || isLoading}
              className={PAGINATION_BUTTON_CLASS}
            >
              <ChevronLeft className="size-3.5" />
              Previous
            </button>
            <button
              type="button"
              onClick={() => {
                if (claimsPage?.nextCursor) {
                  onNextPage(claimsPage.nextCursor)
                }
              }}
              disabled={!hasNextPage || isLoading}
              className={PAGINATION_BUTTON_CLASS}
            >
              Next
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <ClaimsTableSkeleton />
      ) : claims.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-muted-foreground">
          No claims match the selected filters.
        </p>
      ) : (
        <div className={DATA_TABLE_SCROLL_WRAPPER_CLASS}>
          <table className={`${DATA_TABLE_CLASS} min-w-220 border-collapse`}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={getDataTableHeadCellClass({ nowrap: true })}>
                  Claim
                </th>
                <th className={getDataTableHeadCellClass({ nowrap: true })}>
                  Employee
                </th>
                <th className={getDataTableHeadCellClass({ nowrap: true })}>
                  Travel Date
                </th>
                <th className={getDataTableHeadCellClass({ nowrap: true })}>
                  Submission Date
                </th>
                <th className={getDataTableHeadCellClass({ nowrap: true })}>
                  Status
                </th>
                <th className={getDataTableHeadCellClass({ nowrap: true })}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className={DATA_TABLE_BODY_CLASS}>
              {claims.map((claim) => (
                <tr key={claim.claim_id} className={DATA_TABLE_ROW_CLASS}>
                  <td
                    className={getDataTableCellClass({
                      weight: 'medium',
                      nowrap: true,
                    })}
                  >
                    <Link
                      href={`/claims/${claim.claim_id}?from=admin-dashboard`}
                      className="font-semibold text-primary transition-colors hover:text-primary-hover"
                    >
                      {claim.claim_number ?? 'NA'}
                    </Link>
                  </td>
                  <td
                    className={getDataTableCellClass({
                      muted: true,
                      nowrap: true,
                    })}
                  >
                    {claim.employee_name} ({claim.employee_id})
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
                    {claim.submitted_at
                      ? formatDatetime(claim.submitted_at)
                      : '-'}
                  </td>
                  <td className={getDataTableCellClass({ nowrap: true })}>
                    <span className="rounded-full border border-border px-2 py-1 text-xs font-medium text-foreground">
                      {claim.status_name}
                    </span>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
