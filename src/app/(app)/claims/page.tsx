import type { Metadata } from 'next'

import { ClaimList } from '@/features/claims/ui/components/claim-list'
import { ClaimsFiltersBar } from '@/features/claims/ui/components/claims-filters-bar'
import { ClaimAnalyticsCards } from '@/components/ui/claim-analytics-cards'
import {
  getClaimStatusCatalog,
  getMyClaimsStats,
  getMyClaimsTotalCount,
  getMyClaimsPaginated,
} from '@/features/claims/data/queries'
import { requireCurrentUser } from '@/features/auth/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { canAccessEmployeeClaims } from '@/features/employees/permissions'
import { getEmployeeByEmail } from '@/lib/services/employee-service'
import { getAllWorkLocations } from '@/lib/services/config-service'
import {
  addMyClaimsFiltersToParams,
  normalizeMyClaimsFilters,
} from '@/features/claims/utils/filters'
import { canDownloadClaimsCsv } from '@/features/claims/utils/export-permissions'
import {
  buildCursorNavigationLinks,
  decodeCursorTrail,
  encodeCursorTrail,
  getCursorTotalPages,
} from '@/lib/utils/pagination'
import {
  buildPathWithSearchParams,
  createNonEmptySearchParams,
  toSortedQueryString,
} from '@/lib/utils/search-params'
import { redirect } from 'next/navigation'
import { PaginationUrlCleanup } from '@/components/ui/pagination-url-cleanup'

import type { MyClaimsFilters } from '@/features/claims/types'

export const metadata: Metadata = { title: 'My Claims' }

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
  const [user, supabase] = await Promise.all([
    requireCurrentUser('/login'),
    createSupabaseServerClient(),
  ])
  const employee = await getEmployeeByEmail(supabase, user.email ?? '')

  if (!employee || !(await canAccessEmployeeClaims(supabase, employee))) {
    redirect('/dashboard')
  }

  const resolvedSearch = await searchParams
  const claimDateFrom =
    resolvedSearch?.claimDateFrom ?? resolvedSearch?.claimDate
  const claimDateTo = resolvedSearch?.claimDateTo ?? resolvedSearch?.claimDate

  const rawFilters = {
    claimStatus: resolvedSearch?.claimStatus,
    workLocation: resolvedSearch?.workLocation,
    claimDateFrom,
    claimDateTo,
  }

  let filterValidationError: string | null = null

  const normalizedFilters: MyClaimsFilters = (() => {
    try {
      return normalizeMyClaimsFilters(rawFilters)
    } catch (error) {
      filterValidationError =
        error instanceof Error
          ? error.message
          : 'Invalid claim filters provided.'

      return normalizeMyClaimsFilters({
        claimStatus: rawFilters.claimStatus,
        workLocation: rawFilters.workLocation,
      })
    }
  })()

  const filterFormValues: MyClaimsFilters = filterValidationError
    ? {
        ...normalizedFilters,
        claimDateFrom: claimDateFrom ?? null,
        claimDateTo: claimDateTo ?? null,
      }
    : normalizedFilters

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
    !filterValidationError &&
    toSortedQueryString(currentParams) !== toSortedQueryString(canonicalParams)
  ) {
    redirect(buildPathWithSearchParams('/claims', canonicalParams))
  }

  const paginationQuery = Object.fromEntries(canonicalParams.entries())

  const [claims, statusCatalog, workLocations, stats, claimsTotalCount] =
    await Promise.all([
      getMyClaimsPaginated(
        supabase,
        employee.id,
        cursor,
        10,
        normalizedFilters
      ),
      getClaimStatusCatalog(supabase),
      getAllWorkLocations(supabase),
      getMyClaimsStats(supabase, employee.id),
      getMyClaimsTotalCount(supabase, employee.id, normalizedFilters),
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

  const claimsTotalPages = getCursorTotalPages(claimsTotalCount, claims.limit)

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
  const canExportCsv = canDownloadClaimsCsv(
    employee.designations?.designation_name
  )

  return (
    <>
      <PaginationUrlCleanup keys={['cursor', 'trail']} />
      <main className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-6">
            <ClaimsFiltersBar
              filters={filterFormValues}
              statusCatalog={statusCatalog}
              workLocationOptions={workLocationOptions}
              exportCurrentPageHref={exportCurrentPageHref}
              exportAllHref={exportAllHref}
              canExportCsv={canExportCsv}
              validationError={filterValidationError}
            />
          </div>

          <ClaimAnalyticsCards
            className="mb-6"
            cards={[
              {
                label: 'Total Claims',
                count: stats.total.count,
                amount: stats.total.amount,
                tone: 'neutral',
              },
              {
                label: 'Pending',
                count: stats.pending.count,
                amount: stats.pending.amount,
                tone: 'pending',
              },
              {
                label: 'Rejected',
                count: stats.rejected.count,
                amount: stats.rejected.amount,
                tone: 'rejected',
              },
              {
                label: 'Rejected - Allow Reclaim',
                count: stats.rejectedAllowReclaim.count,
                amount: stats.rejectedAllowReclaim.amount,
                tone: 'finance',
              },
            ]}
          />

          <ClaimList
            claims={claims}
            pagination={{
              ...claimsPagination,
              pageSize: claims.limit,
              totalPages: claimsTotalPages,
              totalItems: claimsTotalCount,
            }}
          />
        </div>
      </main>
    </>
  )
}
