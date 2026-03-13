import { ClaimList } from '@/features/claims/components/claim-list'
import { ClaimsFiltersBar } from '@/features/claims/components/claims-filters-bar'
import {
  getClaimStatusCatalog,
  getMyClaimsPaginated,
} from '@/features/claims/queries'
import { requireCurrentUser } from '@/features/auth/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { canAccessEmployeeClaims } from '@/features/employees/permissions'
import { getEmployeeByEmail } from '@/lib/services/employee-service'
import { getAllWorkLocations } from '@/lib/services/config-service'
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
import { redirect } from 'next/navigation'

import type { MyClaimsFilters } from '@/features/claims/types'

type ClaimsPageProps = {
  searchParams?: Promise<{
    cursor?: string
    trail?: string
    claimStatus?: string
    workLocation?: string
    claimDate?: string
    claimDateFrom?: string
    claimDateTo?: string
  }>
}

export default async function ClaimsPage({ searchParams }: ClaimsPageProps) {
  const user = await requireCurrentUser('/login')
  const supabase = await createSupabaseServerClient()
  const employee = await getEmployeeByEmail(supabase, user.email ?? '')

  if (!employee || !(await canAccessEmployeeClaims(supabase, employee))) {
    redirect('/dashboard')
  }

  const resolvedSearch = await searchParams
  const claimDate =
    resolvedSearch?.claimDate ??
    (resolvedSearch?.claimDateFrom && resolvedSearch?.claimDateTo
      ? resolvedSearch.claimDateFrom === resolvedSearch.claimDateTo
        ? resolvedSearch.claimDateFrom
        : undefined
      : (resolvedSearch?.claimDateFrom ?? resolvedSearch?.claimDateTo))

  const rawFilters = {
    claimStatus: resolvedSearch?.claimStatus,
    workLocation: resolvedSearch?.workLocation,
    claimDate,
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

  const [claims, statusCatalog, workLocations] = await Promise.all([
    getMyClaimsPaginated(supabase, employee.id, cursor, 10, normalizedFilters),
    getClaimStatusCatalog(supabase),
    getAllWorkLocations(supabase),
  ])

  const workLocationOptions = workLocations

  const claimsPagination = buildCursorNavigationLinks({
    pathname: '/claims',
    query: paginationQuery,
    cursorKey: 'cursor',
    trailKey: 'trail',
    currentCursor: cursor,
    currentTrail: trail,
    nextCursor: claims.nextCursor,
  })

  const currentPageCsvParams = addMyClaimsFiltersToParams(
    new URLSearchParams(),
    normalizedFilters
  )
  currentPageCsvParams.set('mode', 'page')
  if (cursor) {
    currentPageCsvParams.set('cursor', cursor)
  }

  const allRowsCsvParams = addMyClaimsFiltersToParams(
    new URLSearchParams(),
    normalizedFilters
  )
  allRowsCsvParams.set('mode', 'all')

  const exportCurrentPageHref = `/claims/export?${currentPageCsvParams.toString()}`
  const exportAllHref = `/claims/export?${allRowsCsvParams.toString()}`

  return (
    <>
      <main className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-6">
            <ClaimsFiltersBar
              filters={normalizedFilters}
              statusCatalog={statusCatalog}
              workLocationOptions={workLocationOptions}
              exportCurrentPageHref={exportCurrentPageHref}
              exportAllHref={exportAllHref}
            />
          </div>
          <ClaimList claims={claims} pagination={claimsPagination} />
        </div>
      </main>
    </>
  )
}
