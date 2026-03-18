import Link from 'next/link'
import { Filter, Download } from 'lucide-react'

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
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="flex items-center gap-2.5 text-base font-semibold">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
          <Filter className="size-3.5 text-primary" />
        </div>
        Approval Filters
      </h2>

      <form
        action="/approvals"
        method="get"
        className="mt-5 grid gap-4 md:grid-cols-3"
      >
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Status</span>
          <select
            name="claimStatus"
            defaultValue={filters.claimStatus ?? ''}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          >
            <option value="">All Statuses</option>
            {statusCatalog.map((status) => (
              <option key={status.status_id} value={status.status_id}>
                {status.display_label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Employee Name</span>
          <input
            name="employeeName"
            defaultValue={filters.employeeName ?? ''}
            placeholder="Search by employee name"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-muted-foreground"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Claim Date</span>
          <input
            name="claimDate"
            type="date"
            defaultValue={filters.claimDate ?? ''}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </label>

        <div className="md:col-span-3 flex flex-wrap items-center gap-2 pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all duration-150 hover:bg-primary-hover hover:shadow-md"
          >
            Apply Filters
          </button>
          <Link
            href="/approvals"
            className="rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium shadow-xs transition-all hover:bg-muted"
          >
            Clear
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href={exportCurrentPageHref}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2.5 text-xs font-medium shadow-xs transition-all hover:bg-muted"
            >
              <Download className="size-3.5" />
              Page CSV
            </Link>
            <Link
              href={exportAllHref}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2.5 text-xs font-medium shadow-xs transition-all hover:bg-muted"
            >
              <Download className="size-3.5" />
              All CSV
            </Link>
          </div>
        </div>
      </form>
    </section>
  )
}
