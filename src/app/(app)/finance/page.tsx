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
import { getFinanceQueueAction } from '@/features/finance/actions'
import { getFinanceFilterOptions } from '@/features/finance/queries'
import { getFinanceQueueAnalytics } from '@/features/finance/queries/analytics'
import { getFinanceQueueTotalCount } from '@/features/finance/queries'
import type { FinanceDateFilterField } from '@/features/finance/types'
import {
  addFinanceFiltersToParams,
  normalizeFinanceFilters,
} from '@/features/finance/utils/filters'
import { ClaimAnalyticsCards } from '@/components/ui/claim-analytics-cards'
import { FinanceFiltersBar } from '@/features/finance/components/finance-filters-bar'
import { FinanceQueue } from '@/features/finance/components/finance-queue'
import {
  buildPathWithSearchParams,
  createNonEmptySearchParams,
  toSortedQueryString,
} from '@/lib/utils/search-params'

type FinancePageProps = {
  searchParams?: Promise<{
    queueCursor?: string
    queueTrail?: string
    employeeName?: string
    claimNumber?: string
    ownerDesignation?: string
    claimStatus?: string
    workLocation?: string
    dateFilterField?: string
    dateFrom?: string
    dateTo?: string
  }>
}

const PENDING_CLAIMS_DATE_FILTER_OPTIONS: FinanceDateFilterField[] = [
  'claim_date',
  'submitted_at',
]

const PENDING_CLAIMS_DATE_FILTER_OPTION_SET = new Set(
  PENDING_CLAIMS_DATE_FILTER_OPTIONS
)

export default async function FinancePage({ searchParams }: FinancePageProps) {
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
    claimStatus: resolvedSearch?.claimStatus,
    workLocation: resolvedSearch?.workLocation,
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

  // Pending-claims page intentionally does not support HOD filtering.
  const effectiveFilters = {
    ...normalizedFilters,
    hodApproverEmployeeId: null,
    claimStatus: null,
    dateFilterField: PENDING_CLAIMS_DATE_FILTER_OPTION_SET.has(
      normalizedFilters.dateFilterField
    )
      ? normalizedFilters.dateFilterField
      : 'claim_date',
  }

  const normalizedFilterParams = {
    employeeName: effectiveFilters.employeeName ?? undefined,
    claimNumber: effectiveFilters.claimNumber ?? undefined,
    ownerDesignation: effectiveFilters.ownerDesignation ?? undefined,
    hodApproverEmployeeId: effectiveFilters.hodApproverEmployeeId ?? undefined,
    claimStatus: effectiveFilters.claimStatus ?? undefined,
    workLocation: effectiveFilters.workLocation ?? undefined,
    dateFilterField:
      effectiveFilters.dateFilterField !== 'claim_date'
        ? effectiveFilters.dateFilterField
        : undefined,
    dateFrom: effectiveFilters.dateFrom ?? undefined,
    dateTo: effectiveFilters.dateTo ?? undefined,
  }

  const queueCursor = resolvedSearch?.queueCursor ?? null
  const queueTrail = decodeCursorTrail(resolvedSearch?.queueTrail ?? null)

  const canonicalParams = addFinanceFiltersToParams(
    new URLSearchParams(),
    effectiveFilters
  )

  if (queueCursor) {
    canonicalParams.set('queueCursor', queueCursor)
  }
  if (queueTrail.length > 0) {
    canonicalParams.set('queueTrail', encodeCursorTrail(queueTrail))
  }

  const currentParams = createNonEmptySearchParams(resolvedSearch)
  if (
    toSortedQueryString(currentParams) !== toSortedQueryString(canonicalParams)
  ) {
    redirect(buildPathWithSearchParams('/finance', canonicalParams))
  }

  const paginationQuery = Object.fromEntries(canonicalParams.entries())

  const [queue, filterOptions, analytics, queueTotalCount] = await Promise.all([
    getFinanceQueueAction(queueCursor, 10, normalizedFilterParams),
    getFinanceFilterOptions(supabase),
    getFinanceQueueAnalytics(supabase, effectiveFilters),
    getFinanceQueueTotalCount(supabase, effectiveFilters),
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

  const queueTotalPages = getCursorTotalPages(queueTotalCount, queue.limit)

  const currentPageCsvParams = addFinanceFiltersToParams(
    new URLSearchParams(),
    effectiveFilters
  )
  currentPageCsvParams.set('mode', 'page')
  if (queueCursor) {
    currentPageCsvParams.set('queueCursor', queueCursor)
  }

  const allRowsCsvParams = addFinanceFiltersToParams(
    new URLSearchParams(),
    effectiveFilters
  )
  allRowsCsvParams.set('mode', 'all')

  const exportCurrentPageHref = `/finance/pending-export?${currentPageCsvParams.toString()}`
  const exportAllHref = `/finance/pending-export?${allRowsCsvParams.toString()}`

  return (
    <>
      <main className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="space-y-6">
            <FinanceFiltersBar
              pathname="/finance"
              heading="Pending Claims Filters"
              filters={effectiveFilters}
              options={filterOptions}
              showHodApproverFilter={false}
              showClaimStatusFilter={false}
              showActionFilter={false}
              dateFilterOptions={PENDING_CLAIMS_DATE_FILTER_OPTIONS}
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
                  label: 'Pending Claims',
                  count: analytics.pendingFinanceQueue.count,
                  amount: analytics.pendingFinanceQueue.amount,
                  tone: 'finance',
                },
                {
                  label: 'Payment Released',
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
            <FinanceQueue
              queue={queue}
              pagination={{
                ...queuePagination,
                pageSize: queue.limit,
                totalPages: queueTotalPages,
                totalItems: queueTotalCount,
              }}
            />
          </div>
        </div>
      </main>
    </>
  )
}
