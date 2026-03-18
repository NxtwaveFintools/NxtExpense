import Link from 'next/link'
import { Filter, Download } from 'lucide-react'

import type {
  ClaimStatusCatalogItem,
  MyClaimsFilters,
  WorkLocationOption,
} from '@/features/claims/types'

type ClaimsFiltersBarProps = {
  filters: MyClaimsFilters
  statusCatalog: ClaimStatusCatalogItem[]
  workLocationOptions: WorkLocationOption[]
  exportCurrentPageHref: string
  exportAllHref: string
}

export function ClaimsFiltersBar({
  filters,
  statusCatalog,
  workLocationOptions,
  exportCurrentPageHref,
  exportAllHref,
}: ClaimsFiltersBarProps) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="flex items-center gap-2.5 font-display text-base font-semibold">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
          <Filter className="size-3.5 text-primary" />
        </div>
        Filters
      </h2>

      <form
        action="/claims"
        method="get"
        className="mt-5 grid gap-4 md:grid-cols-4"
      >
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Status</span>
          <select
            name="claimStatus"
            defaultValue={filters.claimStatus ?? ''}
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
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
          <span className="font-medium text-foreground">Location</span>
          <select
            name="workLocation"
            defaultValue={filters.workLocation ?? ''}
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          >
            <option value="">All Locations</option>
            {workLocationOptions.map((location) => (
              <option key={location.id} value={location.id}>
                {location.location_name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Claim Date</span>
          <input
            name="claimDate"
            type="date"
            defaultValue={filters.claimDate ?? ''}
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </label>

        <div className="md:col-span-4 flex flex-wrap items-center gap-2 pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover hover:shadow-md active:scale-[0.98]"
          >
            Apply Filters
          </button>
          <Link
            href="/claims"
            className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium shadow-xs transition-all hover:bg-muted"
          >
            Clear
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href={exportCurrentPageHref}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-medium shadow-xs transition-all hover:bg-muted"
            >
              <Download className="size-3.5" />
              Page CSV
            </Link>
            <Link
              href={exportAllHref}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-medium shadow-xs transition-all hover:bg-muted"
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
