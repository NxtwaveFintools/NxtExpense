import { redirect } from 'next/navigation'

import { requireCurrentUser } from '@/features/auth/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getEmployeeByEmail } from '@/lib/services/employee-service'
import { isFinanceTeamMember } from '@/features/finance/permissions'
import {
  buildCursorNavigationLinks,
  decodeCursorTrail,
  encodeCursorTrail,
  getCursorTotalPages,
} from '@/lib/utils/pagination'
import { getFinanceHistoryAction } from '@/features/finance/actions'
import {
  getFinanceFilterOptions,
  getFinanceHistoryTotalCount,
} from '@/features/finance/queries'
import { getFinanceHistoryAnalytics } from '@/features/finance/queries/history-analytics'
import {
  addFinanceFiltersToParams,
  normalizeFinanceFilters,
} from '@/features/finance/utils/filters'
import { ClaimAnalyticsCards } from '@/components/ui/claim-analytics-cards'
import { FinanceFiltersBar } from '@/features/finance/components/finance-filters-bar'
import { FinanceHistoryList } from '@/features/finance/components/finance-history-list'
import {
  buildPathWithSearchParams,
  createNonEmptySearchParams,
  toSortedQueryString,
} from '@/lib/utils/search-params'

type ApprovedHistoryPageProps = {
  searchParams?: Promise<{
    historyCursor?: string
    historyTrail?: string
    employeeName?: string
    claimNumber?: string
    ownerDesignation?: string
    hodApproverEmployeeId?: string
    claimStatus?: string
    workLocation?: string
    actionFilter?: string
    dateFilterField?: string
    dateFrom?: string
    dateTo?: string
  }>
}

export default async function ApprovedHistoryPage({
  searchParams,
}: ApprovedHistoryPageProps) {
  const user = await requireCurrentUser('/login')
  const supabase = await createSupabaseServerClient()
  const employee = await getEmployeeByEmail(supabase, user.email ?? '')

  if (!employee || !(await isFinanceTeamMember(supabase, employee))) {
    redirect('/dashboard')
  }

  const resolvedSearch = await searchParams

  const rawFilters = {
    employeeName: resolvedSearch?.employeeName,
    claimNumber: resolvedSearch?.claimNumber,
    ownerDesignation: resolvedSearch?.ownerDesignation,
    hodApproverEmployeeId: resolvedSearch?.hodApproverEmployeeId,
    claimStatus: resolvedSearch?.claimStatus,
    workLocation: resolvedSearch?.workLocation,
    actionFilter: resolvedSearch?.actionFilter,
    dateFilterField: resolvedSearch?.dateFilterField,
    dateFrom: resolvedSearch?.dateFrom,
    dateTo: resolvedSearch?.dateTo,
  }

  const normalizedFilters = (() => {
    try {
      return normalizeFinanceFilters(rawFilters)
    } catch {
      return normalizeFinanceFilters({})
    }
  })()

  // Approved-history page intentionally does not support HOD filtering.
  const effectiveFilters = {
    ...normalizedFilters,
    hodApproverEmployeeId: null,
    claimStatus: null,
  }

  const normalizedFilterParams = {
    employeeName: effectiveFilters.employeeName ?? undefined,
    claimNumber: effectiveFilters.claimNumber ?? undefined,
    ownerDesignation: effectiveFilters.ownerDesignation ?? undefined,
    hodApproverEmployeeId: effectiveFilters.hodApproverEmployeeId ?? undefined,
    claimStatus: effectiveFilters.claimStatus ?? undefined,
    workLocation: effectiveFilters.workLocation ?? undefined,
    actionFilter: effectiveFilters.actionFilter ?? undefined,
    dateFilterField:
      effectiveFilters.dateFilterField !== 'claim_date'
        ? effectiveFilters.dateFilterField
        : undefined,
    dateFrom: effectiveFilters.dateFrom ?? undefined,
    dateTo: effectiveFilters.dateTo ?? undefined,
  }

  const historyCursor = resolvedSearch?.historyCursor ?? null
  const historyTrail = decodeCursorTrail(resolvedSearch?.historyTrail ?? null)

  const canonicalParams = addFinanceFiltersToParams(
    new URLSearchParams(),
    effectiveFilters
  )

  if (historyCursor) {
    canonicalParams.set('historyCursor', historyCursor)
  }
  if (historyTrail.length > 0) {
    canonicalParams.set('historyTrail', encodeCursorTrail(historyTrail))
  }

  const currentParams = createNonEmptySearchParams(resolvedSearch)
  if (
    toSortedQueryString(currentParams) !== toSortedQueryString(canonicalParams)
  ) {
    redirect(buildPathWithSearchParams('/approved-history', canonicalParams))
  }

  const paginationQuery = Object.fromEntries(canonicalParams.entries())

  const [history, filterOptions, historyTotalCount, analytics] =
    await Promise.all([
      getFinanceHistoryAction(historyCursor, 10, normalizedFilterParams),
      getFinanceFilterOptions(supabase),
      getFinanceHistoryTotalCount(supabase, effectiveFilters),
      getFinanceHistoryAnalytics(supabase, effectiveFilters),
    ])

  const historyPagination = buildCursorNavigationLinks({
    pathname: '/approved-history',
    query: paginationQuery,
    cursorKey: 'historyCursor',
    trailKey: 'historyTrail',
    currentCursor: historyCursor,
    currentTrail: historyTrail,
    nextCursor: history.nextCursor,
  })

  const historyTotalPages = getCursorTotalPages(
    historyTotalCount,
    history.limit
  )

  const currentPageCsvParams = addFinanceFiltersToParams(
    new URLSearchParams(),
    effectiveFilters
  )
  currentPageCsvParams.set('mode', 'page')
  if (historyCursor) {
    currentPageCsvParams.set('historyCursor', historyCursor)
  }

  const allRowsCsvParams = addFinanceFiltersToParams(
    new URLSearchParams(),
    effectiveFilters
  )
  allRowsCsvParams.set('mode', 'all')

  const exportCurrentPageHref = `/approved-history/export?${currentPageCsvParams.toString()}`
  const exportAllHref = `/approved-history/export?${allRowsCsvParams.toString()}`

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="space-y-6">
          <FinanceFiltersBar
            pathname="/approved-history"
            heading="Approved History Filters"
            filters={effectiveFilters}
            options={filterOptions}
            showHodApproverFilter={false}
            showClaimStatusFilter={false}
            exportCurrentPageHref={exportCurrentPageHref}
            exportAllHref={exportAllHref}
          />
          <ClaimAnalyticsCards
            cards={[
              {
                label: 'Total History Records',
                count: analytics.total.count,
                amount: analytics.total.amount,
                tone: 'neutral',
              },
              {
                label: 'Approved History',
                count: analytics.approvedHistory.count,
                amount: analytics.approvedHistory.amount,
                tone: 'approved',
              },
              {
                label: 'Rejected In Finance',
                count: analytics.rejected.count,
                amount: analytics.rejected.amount,
                tone: 'rejected',
              },
              {
                label: 'Other Actions',
                count: analytics.other.count,
                amount: analytics.other.amount,
                tone: 'finance',
              },
            ]}
          />
          <FinanceHistoryList
            source="approved-history"
            history={history}
            pagination={{
              ...historyPagination,
              pageSize: history.limit,
              totalPages: historyTotalPages,
              totalItems: historyTotalCount,
            }}
          />
        </div>
      </div>
    </main>
  )
}
