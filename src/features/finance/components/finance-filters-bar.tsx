import Link from 'next/link'

import type {
  FinanceFilterOptions,
  FinanceFilters,
} from '@/features/finance/types'

type FinanceFiltersBarProps = {
  filters: FinanceFilters
  options: FinanceFilterOptions
}

export function FinanceFiltersBar({
  filters,
  options,
}: FinanceFiltersBarProps) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-base font-semibold">Finance Filters</h2>

      <form
        action="/finance"
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
          <span className="text-foreground/80">Claim Number</span>
          <input
            name="claimNumber"
            defaultValue={filters.claimNumber ?? ''}
            placeholder="Search by claim ID"
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Employee Designation</span>
          <select
            name="ownerDesignation"
            defaultValue={filters.ownerDesignation ?? ''}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            <option value="">All Designations</option>
            {options.ownerDesignations.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">HOD Approver</span>
          <select
            name="hodApproverEmail"
            defaultValue={filters.hodApproverEmail ?? ''}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            <option value="">All HOD Approvers</option>
            {options.hodApprovers.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Claim Status</span>
          <select
            name="claimStatus"
            defaultValue={filters.claimStatus ?? ''}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            <option value="">All Statuses</option>
            {options.claimStatuses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Location</span>
          <select
            name="workLocation"
            defaultValue={filters.workLocation ?? ''}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            <option value="">All Locations</option>
            {options.workLocations.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
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
          <span className="text-foreground/80">Finance Action</span>
          <select
            name="actionFilter"
            defaultValue={filters.actionFilter}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            <option value="all">All Actions</option>
            <option value="issued">Issued</option>
            <option value="finance_rejected">Finance Rejected</option>
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Action Date From</span>
          <input
            name="actionDateFrom"
            type="date"
            defaultValue={filters.actionDateFrom ?? ''}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-foreground/80">Action Date To</span>
          <input
            name="actionDateTo"
            type="date"
            defaultValue={filters.actionDateTo ?? ''}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="md:col-span-4 inline-flex items-center gap-2 text-sm text-foreground/80">
          <input
            name="resubmittedOnly"
            type="checkbox"
            value="true"
            defaultChecked={filters.resubmittedOnly}
          />
          Show resubmitted claims only
        </label>

        <div className="md:col-span-4 flex flex-wrap items-center gap-2 pt-1">
          <button
            type="submit"
            className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background"
          >
            Apply Filters
          </button>
          <Link
            href="/finance"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium"
          >
            Clear Filters
          </Link>
        </div>
      </form>
    </section>
  )
}
