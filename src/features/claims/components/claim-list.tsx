import Link from 'next/link'

import type {
  ClaimStatusCatalogItem,
  PaginatedClaims,
} from '@/features/claims/types'
import { ClaimStatusBadge } from '@/features/claims/components/claim-status-badge'
import { CursorPaginationControls } from '@/components/ui/cursor-pagination-controls'
import { formatDate, formatDatetime } from '@/lib/utils/date'

type ClaimListPagination = {
  backHref: string | null
  nextHref: string | null
  pageNumber: number
}

type ClaimListProps = {
  claims: PaginatedClaims
  statusCatalog: ClaimStatusCatalogItem[]
  pagination: ClaimListPagination
}

export function ClaimList({
  claims,
  statusCatalog,
  pagination,
}: ClaimListProps) {
  if (claims.data.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold">My Claims</h2>
        <p className="mt-2 text-sm text-foreground/70">
          No claims yet. Create your first claim to begin the workflow.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">My Claims</h2>
        <Link
          href="/claims/new"
          className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background"
        >
          New Claim
        </Link>
      </div>

      <CursorPaginationControls
        backHref={pagination.backHref}
        nextHref={pagination.nextHref}
        pageNumber={pagination.pageNumber}
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-230 border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-foreground/70">
              <th className="px-3 py-2 font-medium">Claim ID</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Submitted At</th>
              <th className="px-3 py-2 font-medium">Rework</th>
            </tr>
          </thead>
          <tbody>
            {claims.data.map((claim) => (
              <tr key={claim.id} className="border-b border-border/70">
                <td className="px-3 py-3 font-medium">
                  <Link
                    href={`/claims/${claim.id}`}
                    className="underline decoration-border underline-offset-4 hover:decoration-foreground"
                  >
                    {claim.claim_number}
                  </Link>
                </td>
                <td className="px-3 py-3">{formatDate(claim.claim_date)}</td>
                <td className="px-3 py-3">{claim.work_location}</td>
                <td className="px-3 py-3">
                  Rs. {Number(claim.total_amount).toFixed(2)}
                </td>
                <td className="px-3 py-3">
                  <ClaimStatusBadge
                    status={claim.status}
                    statusCatalog={statusCatalog}
                  />
                </td>
                <td className="px-3 py-3">
                  {claim.submitted_at
                    ? formatDatetime(claim.submitted_at)
                    : '-'}
                </td>
                <td className="px-3 py-3">
                  {claim.resubmission_count > 0 ? (
                    <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                      Resubmitted ({claim.resubmission_count})
                    </span>
                  ) : (
                    <span className="text-xs text-foreground/60">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
