import Link from 'next/link'

import type { ApprovalHistoryFilters } from '@/features/approvals/types'

type ApprovalFiltersBarProps = {
  filters: ApprovalHistoryFilters
  exportCurrentPageHref: string
  exportAllHref: string
}

export function ApprovalFiltersBar({
  filters,
  exportCurrentPageHref,
  exportAllHref,
}: ApprovalFiltersBarProps) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-base font-semibold">Approval Filters</h2>

      <form
        action="/approvals"
        method="get"
        className="mt-4 grid gap-3 md:grid-cols-4"
      >
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
          <span className="text-foreground/80">Actor Bucket</span>
          <select
            name="actorFilter"
            defaultValue={filters.actorFilter}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            <option value="all">Select All</option>
            <option value="sbh">State Business Head</option>
            <option value="hod">HOD (Final-Level Approver)</option>
            <option value="finance">Finance Team</option>
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Claim Date From</span>
          <input
            name="claimDateFrom"
            type="date"
            defaultValue={filters.claimDateFrom ?? ''}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Claim Date To</span>
          <input
            name="claimDateTo"
            type="date"
            defaultValue={filters.claimDateTo ?? ''}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">HOD Approved From</span>
          <input
            name="hodApprovedFrom"
            type="date"
            defaultValue={filters.hodApprovedFrom ?? ''}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">HOD Approved To</span>
          <input
            name="hodApprovedTo"
            type="date"
            defaultValue={filters.hodApprovedTo ?? ''}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Finance Approved From</span>
          <input
            name="financeApprovedFrom"
            type="date"
            defaultValue={filters.financeApprovedFrom ?? ''}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Finance Approved To</span>
          <input
            name="financeApprovedTo"
            type="date"
            defaultValue={filters.financeApprovedTo ?? ''}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <div className="md:col-span-4 flex flex-wrap items-center gap-2 pt-1">
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
