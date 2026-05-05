import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { requireCurrentUser } from '@/features/auth/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import { getEmployeeByEmail } from '@/lib/services/employee-service'
import { isFinanceTeamMember } from '@/features/finance/permissions'
import {
  buildCursorNavigationLinks,
  CURSOR_PAGE_SIZE_OPTIONS,
  DEFAULT_CURSOR_PAGE_SIZE,
  decodeCursorTrail,
  encodeCursorTrail,
  getCursorTotalPages,
  normalizeCursorPageSize,
} from '@/lib/utils/pagination'
import { getFinanceQueueAction } from '@/features/finance/server/actions'
import {
  getFinanceFilterOptions,
  getFinanceQueueAnalytics,
  getFinanceQueueTotalCount,
} from '@/features/finance/data/queries'
import type { FinanceDateFilterField } from '@/features/finance/types'
import {
  addFinanceFiltersToParams,
  normalizeFinanceFilters,
} from '@/features/finance/utils/filters'
import { ClaimAnalyticsCards } from '@/components/ui/claim-analytics-cards'
import { FinanceFiltersBar } from '@/features/finance/ui/components/finance-filters-bar'
import { FinanceQueue } from '@/features/finance/ui/components/finance-queue'
import {
  buildPathWithSearchParams,
  createNonEmptySearchParams,
  toSortedQueryString,
} from '@/lib/utils/search-params'
import { PaginationUrlCleanup } from '@/components/ui/pagination-url-cleanup'

type FinancePageProps = {
  searchParams?: Promise<{
    queueCursor?: string
    queueTrail?: string
    pageSize?: string
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
  'hod_approved_date',
]

const PENDING_CLAIMS_DATE_FILTER_OPTION_SET = new Set(
  PENDING_CLAIMS_DATE_FILTER_OPTIONS
)

export const metadata: Metadata = { title: 'Finance' }

export default async function FinancePage({ searchParams }: FinancePageProps) {
  const [user, supabase] = await Promise.all([
    requireCurrentUser('/login'),
    createSupabaseServerClient(),
  ])
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
  const pageSize = normalizeCursorPageSize(resolvedSearch?.pageSize)

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
  if (pageSize !== DEFAULT_CURSOR_PAGE_SIZE) {
    canonicalParams.set('pageSize', String(pageSize))
  }

  const currentParams = createNonEmptySearchParams(resolvedSearch)
  if (
    toSortedQueryString(currentParams) !== toSortedQueryString(canonicalParams)
  ) {
    redirect(buildPathWithSearchParams('/finance', canonicalParams))
  }

  const paginationQuery = Object.fromEntries(canonicalParams.entries())

  const [queue, filterOptions, analytics, queueTotalCount] = await Promise.all([
    getFinanceQueueAction(queueCursor, pageSize, normalizedFilterParams),
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

  const pageSizeHrefByValue = Object.fromEntries(
    CURSOR_PAGE_SIZE_OPTIONS.map((size) => {
      const params = addFinanceFiltersToParams(
        new URLSearchParams(),
        effectiveFilters
      )
      if (size !== DEFAULT_CURSOR_PAGE_SIZE) {
        params.set('pageSize', String(size))
      }
      return [size, buildPathWithSearchParams('/finance', params)]
    })
  )

  const currentPageCsvParams = addFinanceFiltersToParams(
    new URLSearchParams(),
    effectiveFilters
  )
  currentPageCsvParams.set('mode', 'page')
  if (queueCursor) {
    currentPageCsvParams.set('queueCursor', queueCursor)
  }
  if (pageSize !== DEFAULT_CURSOR_PAGE_SIZE) {
    currentPageCsvParams.set('pageSize', String(pageSize))
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
      <PaginationUrlCleanup keys={['queueCursor', 'queueTrail']} />
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
                pageSizeOptions: [...CURSOR_PAGE_SIZE_OPTIONS],
                pageSizeHrefByValue,
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
