import Link from 'next/link'
import { Filter } from 'lucide-react'

import { CsvExportActions } from '@/components/ui/csv-export-actions'

import type { ClaimStatusCatalogItem } from '@/features/claims/types'
import type { ApprovalHistoryFilters } from '@/features/approvals/types'

type ApprovalFiltersBarProps = {
  filters: ApprovalHistoryFilters
  statusCatalog: ClaimStatusCatalogItem[]
  employeeNameSuggestions: string[]
  validationError?: string | null
  exportCurrentPageHref: string
  exportAllHref: string
}

export function ApprovalFiltersBar({
  filters,
  statusCatalog,
  employeeNameSuggestions,
  validationError,
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
        className="mt-5 grid gap-4 md:grid-cols-4"
      >
        <input
          type="hidden"
          name="claimDateSort"
          value={filters.claimDateSort}
        />

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Status</span>
          <select
            name="claimStatus"
            defaultValue={filters.claimStatus ?? ''}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          >
            <option value="">All Statuses</option>
            {statusCatalog.map((status) => (
              <option
                key={status.status_filter_value}
                value={status.status_filter_value}
              >
                {status.display_label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Employee Name</span>
          <input
            name="employeeName"
            list="approval-employee-name-options"
            defaultValue={filters.employeeName ?? ''}
            placeholder="Search by employee name"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-muted-foreground"
          />
          {employeeNameSuggestions.length > 0 ? (
            <datalist id="approval-employee-name-options">
              {employeeNameSuggestions.map((employeeName) => (
                <option key={employeeName} value={employeeName} />
              ))}
            </datalist>
          ) : null}
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Travel Date From</span>
          <input
            name="claimDateFrom"
            type="date"
            defaultValue={filters.claimDateFrom ?? ''}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Travel Date To</span>
          <input
            name="claimDateTo"
            type="date"
            defaultValue={filters.claimDateTo ?? ''}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Amount Condition</span>
          <select
            name="amountOperator"
            defaultValue={filters.amountOperator}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          >
            <option value="lte">Less than or equal (≤)</option>
            <option value="gte">Greater than or equal (≥)</option>
            <option value="eq">Equal to (=)</option>
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Amount Value</span>
          <input
            name="amountValue"
            type="number"
            min="0"
            step="0.01"
            defaultValue={
              filters.amountValue === null ? '' : String(filters.amountValue)
            }
            placeholder="Enter amount"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-muted-foreground"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Location Type</span>
          <select
            name="locationType"
            defaultValue={filters.locationType ?? ''}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          >
            <option value="">All Location Types</option>
            <option value="base">Base Location</option>
            <option value="outstation">Outstation</option>
          </select>
        </label>

        {validationError ? (
          <p className="md:col-span-4 text-sm font-medium text-rose-600">
            {validationError}
          </p>
        ) : null}

        <div className="md:col-span-4 flex flex-wrap items-center gap-2 pt-2">
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
          <CsvExportActions
            exportCurrentPageHref={exportCurrentPageHref}
            exportAllHref={exportAllHref}
            buttonClassName="rounded-md"
          />
        </div>
      </form>
    </section>
  )
}
