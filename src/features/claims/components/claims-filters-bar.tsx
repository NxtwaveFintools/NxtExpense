import Link from 'next/link'

import type {
  ClaimStatusCatalogItem,
  MyClaimsFilters,
} from '@/features/claims/types'
import { WORK_LOCATION_FILTER_VALUES } from '@/features/claims/types'

type ClaimsFiltersBarProps = {
  filters: MyClaimsFilters
  statusCatalog: ClaimStatusCatalogItem[]
}

export function ClaimsFiltersBar({
  filters,
  statusCatalog,
}: ClaimsFiltersBarProps) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-base font-semibold">My Claims Filters</h2>

      <form
        action="/claims"
        method="get"
        className="mt-4 grid gap-3 md:grid-cols-4"
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
          <span className="text-foreground/80">Location</span>
          <select
            name="workLocation"
            defaultValue={filters.workLocation ?? ''}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            <option value="">All Locations</option>
            {WORK_LOCATION_FILTER_VALUES.map((location) => (
              <option key={location} value={location}>
                {location}
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
            href="/claims"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium"
          >
            Clear Filters
          </Link>
        </div>
      </form>
    </section>
  )
}
