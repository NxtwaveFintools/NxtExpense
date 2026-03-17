import { redirect } from 'next/navigation'

import { requireCurrentUser } from '@/features/auth/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import { getEmployeeByEmail } from '@/lib/services/employee-service'
import { isFinanceTeamMember } from '@/features/finance/permissions'
import {
  buildCursorNavigationLinks,
  decodeCursorTrail,
  encodeCursorTrail,
} from '@/lib/utils/pagination'
import {
  getFinanceHistoryAction,
  getFinanceQueueAction,
} from '@/features/finance/actions'
import { getFinanceFilterOptions } from '@/features/finance/queries'
import { getFinanceQueueAnalytics } from '@/features/finance/queries/analytics'
import {
  addFinanceFiltersToParams,
  normalizeFinanceFilters,
} from '@/features/finance/utils/filters'
import { ClaimAnalyticsCards } from '@/components/ui/claim-analytics-cards'
import { FinanceFiltersBar } from '@/features/finance/components/finance-filters-bar'
import { FinanceQueue } from '@/features/finance/components/finance-queue'
import { FinanceHistoryList } from '@/features/finance/components/finance-history-list'
import {
  buildPathWithSearchParams,
  createNonEmptySearchParams,
  toSortedQueryString,
} from '@/lib/utils/search-params'

type FinancePageProps = {
  searchParams?: Promise<{
    queueCursor?: string
    queueTrail?: string
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
    claimDate?: string
    claimDateFrom?: string
    claimDateTo?: string
    actionDateFrom?: string
    actionDateTo?: string
  }>
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  const user = await requireCurrentUser('/login')
  const supabase = await createSupabaseServerClient()
  const employee = await getEmployeeByEmail(supabase, user.email ?? '')

  if (!employee || !(await isFinanceTeamMember(supabase, employee))) {
    redirect('/dashboard')
  }

  const resolvedSearch = await searchParams

  const legacyClaimDateFrom =
    resolvedSearch?.claimDateFrom ?? resolvedSearch?.claimDate
  const legacyClaimDateTo =
    resolvedSearch?.claimDateTo ?? resolvedSearch?.claimDate
  const legacyFinanceApprovedDateFrom = resolvedSearch?.actionDateFrom
  const legacyFinanceApprovedDateTo = resolvedSearch?.actionDateTo

  const dateFilterField =
    resolvedSearch?.dateFilterField ??
    (legacyFinanceApprovedDateFrom || legacyFinanceApprovedDateTo
      ? 'finance_approved_date'
      : 'claim_date')

  const dateFrom =
    resolvedSearch?.dateFrom ??
    (dateFilterField === 'finance_approved_date'
      ? legacyFinanceApprovedDateFrom
      : legacyClaimDateFrom)

  const dateTo =
    resolvedSearch?.dateTo ??
    (dateFilterField === 'finance_approved_date'
      ? legacyFinanceApprovedDateTo
      : legacyClaimDateTo)

  const rawFilters = {
    employeeName: resolvedSearch?.employeeName,
    claimNumber: resolvedSearch?.claimNumber,
    ownerDesignation: resolvedSearch?.ownerDesignation,
    hodApproverEmployeeId: resolvedSearch?.hodApproverEmployeeId,
    claimStatus: resolvedSearch?.claimStatus,
    workLocation: resolvedSearch?.workLocation,
    actionFilter: resolvedSearch?.actionFilter,
    dateFilterField,
    dateFrom,
    dateTo,
  }

  const normalizedFilters = (() => {
    try {
      return normalizeFinanceFilters(rawFilters)
    } catch {
      return normalizeFinanceFilters({})
    }
  })()

  const normalizedFilterParams = {
    employeeName: normalizedFilters.employeeName ?? undefined,
    claimNumber: normalizedFilters.claimNumber ?? undefined,
    ownerDesignation: normalizedFilters.ownerDesignation ?? undefined,
    hodApproverEmployeeId: normalizedFilters.hodApproverEmployeeId ?? undefined,
    claimStatus: normalizedFilters.claimStatus ?? undefined,
    workLocation: normalizedFilters.workLocation ?? undefined,
    actionFilter:
      normalizedFilters.actionFilter !== 'all'
        ? normalizedFilters.actionFilter
        : undefined,
    dateFilterField:
      normalizedFilters.dateFilterField !== 'claim_date'
        ? normalizedFilters.dateFilterField
        : undefined,
    dateFrom: normalizedFilters.dateFrom ?? undefined,
    dateTo: normalizedFilters.dateTo ?? undefined,
  }

  const queueCursor = resolvedSearch?.queueCursor ?? null
  const queueTrail = decodeCursorTrail(resolvedSearch?.queueTrail ?? null)
  const historyCursor = resolvedSearch?.historyCursor ?? null
  const historyTrail = decodeCursorTrail(resolvedSearch?.historyTrail ?? null)

  const canonicalParams = addFinanceFiltersToParams(
    new URLSearchParams(),
    normalizedFilters
  )

  if (queueCursor) {
    canonicalParams.set('queueCursor', queueCursor)
  }
  if (queueTrail.length > 0) {
    canonicalParams.set('queueTrail', encodeCursorTrail(queueTrail))
  }
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
    redirect(buildPathWithSearchParams('/finance', canonicalParams))
  }

  const paginationQuery = Object.fromEntries(canonicalParams.entries())

  const [queue, history, filterOptions, analytics] = await Promise.all([
    getFinanceQueueAction(queueCursor, 10, normalizedFilterParams),
    getFinanceHistoryAction(historyCursor, 10, normalizedFilterParams),
    getFinanceFilterOptions(supabase),
    getFinanceQueueAnalytics(supabase, normalizedFilters),
  ])

  const queuePagination = buildCursorNavigationLinks({
    pathname: '/finance',
    query: paginationQuery,
    cursorKey: 'queueCursor',
    trailKey: 'queueTrail',
    currentCursor: queueCursor,
    currentTrail: queueTrail,
    nextCursor: queue.nextCursor,
  })

  const historyPagination = buildCursorNavigationLinks({
    pathname: '/finance',
    query: paginationQuery,
    cursorKey: 'historyCursor',
    trailKey: 'historyTrail',
    currentCursor: historyCursor,
    currentTrail: historyTrail,
    nextCursor: history.nextCursor,
  })

  const currentPageCsvParams = addFinanceFiltersToParams(
    new URLSearchParams(),
    normalizedFilters
  )
  currentPageCsvParams.set('mode', 'page')
  if (historyCursor) {
    currentPageCsvParams.set('historyCursor', historyCursor)
  }

  const allRowsCsvParams = addFinanceFiltersToParams(
    new URLSearchParams(),
    normalizedFilters
  )
  allRowsCsvParams.set('mode', 'all')

  const exportCurrentPageHref = `/finance/export?${currentPageCsvParams.toString()}`
  const exportAllHref = `/finance/export?${allRowsCsvParams.toString()}`

  return (
    <>
      <main className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="space-y-6">
            <FinanceFiltersBar
              filters={normalizedFilters}
              options={filterOptions}
              exportCurrentPageHref={exportCurrentPageHref}
              exportAllHref={exportAllHref}
            />
            <ClaimAnalyticsCards
              cards={[
                {
                  label: 'Total Claims',
                  count: analytics.total.count,
                  amount: analytics.total.amount,
                  tone: 'neutral',
                },
                {
                  label: 'Pending Finance Queue',
                  count: analytics.pendingFinanceQueue.count,
                  amount: analytics.pendingFinanceQueue.amount,
                  tone: 'finance',
                },
                {
                  label: 'Finance Approved',
                  count: analytics.approved.count,
                  amount: analytics.approved.amount,
                  tone: 'approved',
                },
                {
                  label: 'Rejected',
                  count: analytics.rejected.count,
                  amount: analytics.rejected.amount,
                  tone: 'rejected',
                },
              ]}
            />
            <FinanceQueue queue={queue} pagination={queuePagination} />
            <FinanceHistoryList
              history={history}
              pagination={historyPagination}
            />
          </div>
        </div>
      </main>
    </>
  )
}
