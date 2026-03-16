import Link from 'next/link'

import type { ClaimStatusCatalogItem } from '@/features/claims/types'
import type { ApprovalHistoryFilters } from '@/features/approvals/types'

type ApprovalFiltersBarProps = {
  filters: ApprovalHistoryFilters
  statusCatalog: ClaimStatusCatalogItem[]
  exportCurrentPageHref: string
  exportAllHref: string
}

export function ApprovalFiltersBar({
  filters,
  statusCatalog,
  exportCurrentPageHref,
  exportAllHref,
}: ApprovalFiltersBarProps) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-base font-semibold">Approval Filters</h2>

      <form
        action="/approvals"
        method="get"
        className="mt-4 grid gap-3 md:grid-cols-3"
      >
        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Status</span>
          <select
            name="claimStatus"
            defaultValue={filters.claimStatus ?? ''}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            <option value="">All Statuses</option>
            {statusCatalog.map((status) => (
              <option key={status.status} value={status.status}>
                {status.display_label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Employee Name</span>
          <input
            name="employeeName"
            defaultValue={filters.employeeName ?? ''}
            placeholder="Search by employee name"
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Claim Date</span>
          <input
            name="claimDate"
            type="date"
            defaultValue={filters.claimDate ?? ''}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <div className="md:col-span-3 flex flex-wrap items-center gap-2 pt-1">
          <button
            type="submit"
            className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background"
          >
            Apply Filters
          </button>
          <Link
            href="/approvals"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium"
          >
            Clear Filters
          </Link>
          <Link
            href={exportCurrentPageHref}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium"
          >
            Download Current Page CSV
          </Link>
          <Link
            href={exportAllHref}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium"
          >
            Download All Filtered CSV
          </Link>
        </div>
      </form>
    </section>
  )
}
