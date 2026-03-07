import { ClaimList } from '@/features/claims/components/claim-list'
import { ClaimsFiltersBar } from '@/features/claims/components/claims-filters-bar'
import {
  getClaimStatusCatalog,
  getMyClaimsPaginated,
} from '@/features/claims/queries'
import { requireCurrentUser } from '@/features/auth/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { canAccessEmployeeClaims } from '@/features/employees/permissions'
import { getEmployeeByEmail } from '@/features/employees/queries'
import {
  addMyClaimsFiltersToParams,
  normalizeMyClaimsFilters,
} from '@/features/claims/utils/filters'
import {
  buildCursorNavigationLinks,
  decodeCursorTrail,
  encodeCursorTrail,
} from '@/lib/utils/pagination'
import {
  buildPathWithSearchParams,
  createNonEmptySearchParams,
  toSortedQueryString,
} from '@/lib/utils/search-params'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import type { MyClaimsFilters } from '@/features/claims/types'

type ClaimsPageProps = {
  searchParams?: Promise<{
    cursor?: string
    trail?: string
    claimStatus?: string
    workLocation?: string
    claimDateFrom?: string
    claimDateTo?: string
    resubmittedOnly?: string
  }>
}

export default async function ClaimsPage({ searchParams }: ClaimsPageProps) {
  const user = await requireCurrentUser('/login')
  const supabase = await createSupabaseServerClient()
  const employee = await getEmployeeByEmail(supabase, user.email ?? '')

  if (!employee || !canAccessEmployeeClaims(employee)) {
    redirect('/dashboard')
  }

  const resolvedSearch = await searchParams
  const rawFilters = {
    claimStatus: resolvedSearch?.claimStatus,
    workLocation: resolvedSearch?.workLocation,
    claimDateFrom: resolvedSearch?.claimDateFrom,
    claimDateTo: resolvedSearch?.claimDateTo,
    resubmittedOnly: resolvedSearch?.resubmittedOnly,
  }
  const normalizedFilters: MyClaimsFilters = (() => {
    try {
      return normalizeMyClaimsFilters(rawFilters)
    } catch {
      return normalizeMyClaimsFilters({})
    }
  })()

  const cursor = resolvedSearch?.cursor ?? null
  const trail = decodeCursorTrail(resolvedSearch?.trail ?? null)

  const canonicalParams = addMyClaimsFiltersToParams(
    new URLSearchParams(),
    normalizedFilters
  )
  if (cursor) {
    canonicalParams.set('cursor', cursor)
  }
  if (trail.length > 0) {
    canonicalParams.set('trail', encodeCursorTrail(trail))
  }

  const currentParams = createNonEmptySearchParams(resolvedSearch)
  if (
    toSortedQueryString(currentParams) !== toSortedQueryString(canonicalParams)
  ) {
    redirect(buildPathWithSearchParams('/claims', canonicalParams))
  }

  const paginationQuery = Object.fromEntries(canonicalParams.entries())

  const [claims, statusCatalog] = await Promise.all([
    getMyClaimsPaginated(supabase, employee.id, cursor, 10, normalizedFilters),
    getClaimStatusCatalog(supabase),
  ])

  const claimsPagination = buildCursorNavigationLinks({
    pathname: '/claims',
    query: paginationQuery,
    cursorKey: 'cursor',
    trailKey: 'trail',
    currentCursor: cursor,
    currentTrail: trail,
    nextCursor: claims.nextCursor,
  })

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="inline-flex rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium"
          >
            Back to Dashboard
          </Link>
        </div>
        <div className="mb-6">
          <ClaimsFiltersBar
            filters={normalizedFilters}
            statusCatalog={statusCatalog}
          />
        </div>
        <ClaimList
          claims={claims}
          statusCatalog={statusCatalog}
          pagination={claimsPagination}
        />
      </div>
    </main>
  )
}
