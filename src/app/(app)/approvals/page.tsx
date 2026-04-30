import { redirect } from 'next/navigation'

import {
  getApprovalHistoryAction,
  getPendingApprovalsAction,
} from '@/features/approvals/server/actions'
import { ApprovalFiltersBar } from '@/features/approvals/ui/components/approval-filters-bar'
import { ApprovalHistoryList } from '@/features/approvals/ui/components/approval-history-list'
import { ApprovalList } from '@/features/approvals/ui/components/approval-list'
import {
  getApprovalStageAnalytics,
  getFilteredApprovalHistoryCount,
} from '@/features/approvals/data/queries'
import { canViewApprovalHistoryAmount } from '@/features/approvals/utils/amount-visibility'
import {
  addApprovalFiltersToParams,
  normalizeApprovalHistoryFilters,
} from '@/features/approvals/utils/history-filters'
import { requireCurrentUser } from '@/features/auth/queries'
import { getClaimStatusCatalog } from '@/features/claims/data/queries'
import { ClaimAnalyticsCards } from '@/components/ui/claim-analytics-cards'
import { canAccessApprovals } from '@/features/employees/permissions'
import {
  getEmployeeByEmail,
  hasApproverAssignments,
} from '@/lib/services/employee-service'
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
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PaginationUrlCleanup } from '@/components/ui/pagination-url-cleanup'

type ApprovalsPageProps = {
  searchParams?: Promise<{
    pendingCursor?: string
    pendingTrail?: string
    historyCursor?: string
    historyTrail?: string
    claimStatus?: string
    employeeName?: string
    claimDateFrom?: string
    claimDateTo?: string
    amountOperator?: string
    amountValue?: string
    locationType?: string
    claimDateSort?: string
    hodApprovedFrom?: string
    hodApprovedTo?: string
    financeApprovedFrom?: string
    financeApprovedTo?: string
  }>
}

export default async function ApprovalsPage({
  searchParams,
}: ApprovalsPageProps) {
  const user = await requireCurrentUser('/login')
  const supabase = await createSupabaseServerClient()
  const employee = await getEmployeeByEmail(supabase, user.email ?? '')

  if (!employee) {
    redirect('/dashboard')
  }

  const approverAccess = await hasApproverAssignments(
    supabase,
    employee.employee_email
  )

  if (!canAccessApprovals(approverAccess)) {
    redirect('/dashboard')
  }

  const resolvedSearch = await searchParams
  const rawFilters = {
    claimStatus: resolvedSearch?.claimStatus,
    employeeName: resolvedSearch?.employeeName,
    claimDateFrom: resolvedSearch?.claimDateFrom,
    claimDateTo: resolvedSearch?.claimDateTo,
    amountOperator: resolvedSearch?.amountOperator,
    amountValue: resolvedSearch?.amountValue,
    locationType: resolvedSearch?.locationType,
    claimDateSort: resolvedSearch?.claimDateSort,
    hodApprovedFrom: resolvedSearch?.hodApprovedFrom,
    hodApprovedTo: resolvedSearch?.hodApprovedTo,
    financeApprovedFrom: resolvedSearch?.financeApprovedFrom,
    financeApprovedTo: resolvedSearch?.financeApprovedTo,
  }

  let filterValidationError: string | null = null
  const normalizedFilters = (() => {
    try {
      return normalizeApprovalHistoryFilters(rawFilters)
    } catch (error) {
      filterValidationError =
        error instanceof Error ? error.message : 'Invalid filters provided.'

      return {
        claimStatus: null,
        employeeName: null,
        claimDateFrom: null,
        claimDateTo: null,
        amountOperator: 'lte' as const,
        amountValue: null,
        locationType: null,
        claimDateSort: 'desc' as const,
        hodApprovedFrom: null,
        hodApprovedTo: null,
        financeApprovedFrom: null,
        financeApprovedTo: null,
      }
    }
  })()

  const normalizedFilterParams = {
    claimStatus: normalizedFilters.claimStatus ?? undefined,
    employeeName: normalizedFilters.employeeName ?? undefined,
    claimDateFrom: normalizedFilters.claimDateFrom ?? undefined,
    claimDateTo: normalizedFilters.claimDateTo ?? undefined,
    amountOperator: normalizedFilters.amountOperator,
    amountValue:
      normalizedFilters.amountValue === null
        ? undefined
        : String(normalizedFilters.amountValue),
    locationType: normalizedFilters.locationType ?? undefined,
    claimDateSort: normalizedFilters.claimDateSort,
    hodApprovedFrom: normalizedFilters.hodApprovedFrom ?? undefined,
    hodApprovedTo: normalizedFilters.hodApprovedTo ?? undefined,
    financeApprovedFrom: normalizedFilters.financeApprovedFrom ?? undefined,
    financeApprovedTo: normalizedFilters.financeApprovedTo ?? undefined,
  }

  const pendingCursor = resolvedSearch?.pendingCursor ?? null
  const pendingTrail = decodeCursorTrail(resolvedSearch?.pendingTrail ?? null)
  const historyCursor = resolvedSearch?.historyCursor ?? null
  const historyTrail = decodeCursorTrail(resolvedSearch?.historyTrail ?? null)

  const canonicalParams = addApprovalFiltersToParams(
    new URLSearchParams(),
    normalizedFilters
  )

  if (pendingCursor) {
    canonicalParams.set('pendingCursor', pendingCursor)
  }
  if (pendingTrail.length > 0) {
    canonicalParams.set('pendingTrail', encodeCursorTrail(pendingTrail))
  }
  if (historyCursor) {
    canonicalParams.set('historyCursor', historyCursor)
  }
  if (historyTrail.length > 0) {
    canonicalParams.set('historyTrail', encodeCursorTrail(historyTrail))
  }

  const currentParams = createNonEmptySearchParams(resolvedSearch)
  if (
    !filterValidationError &&
    toSortedQueryString(currentParams) !== toSortedQueryString(canonicalParams)
  ) {
    redirect(buildPathWithSearchParams('/approvals', canonicalParams))
  }

  const paginationQuery = Object.fromEntries(canonicalParams.entries())

  const [
    approvals,
    history,
    statusCatalog,
    approvalAnalytics,
    historyTotalCount,
  ] = await Promise.all([
    getPendingApprovalsAction(pendingCursor, 10, normalizedFilterParams),
    getApprovalHistoryAction(historyCursor, 10, normalizedFilterParams),
    getClaimStatusCatalog(supabase),
    getApprovalStageAnalytics(supabase, user.email ?? '', {
      ...normalizedFilters,
    }),
    getFilteredApprovalHistoryCount(supabase, normalizedFilters),
  ])

  const showHistoryAmountColumn = canViewApprovalHistoryAmount(approverAccess)

  const pendingPagination = buildCursorNavigationLinks({
    pathname: '/approvals',
    query: paginationQuery,
    cursorKey: 'pendingCursor',
    trailKey: 'pendingTrail',
    currentCursor: pendingCursor,
    currentTrail: pendingTrail,
    nextCursor: approvals.nextCursor,
  })

  const historyPagination = buildCursorNavigationLinks({
    pathname: '/approvals',
    query: paginationQuery,
    cursorKey: 'historyCursor',
    trailKey: 'historyTrail',
    currentCursor: historyCursor,
    currentTrail: historyTrail,
    nextCursor: history.nextCursor,
  })

  const pendingTotalCount = approvalAnalytics.pendingApprovals.count
  const pendingTotalPages = getCursorTotalPages(
    pendingTotalCount,
    approvals.limit
  )
  const historyTotalPages = getCursorTotalPages(
    historyTotalCount,
    history.limit
  )

  const currentPageCsvParams = addApprovalFiltersToParams(
    new URLSearchParams(),
    normalizedFilters
  )
  currentPageCsvParams.set('mode', 'page')
  if (historyCursor) {
    currentPageCsvParams.set('historyCursor', historyCursor)
  }

  const allRowsCsvParams = addApprovalFiltersToParams(
    new URLSearchParams(),
    normalizedFilters
  )
  allRowsCsvParams.set('mode', 'all')

  const exportCurrentPageHref = `/approvals/export?${currentPageCsvParams.toString()}`
  const exportAllHref = `/approvals/export?${allRowsCsvParams.toString()}`

  return (
    <>
      <PaginationUrlCleanup
        keys={[
          'pendingCursor',
          'pendingTrail',
          'historyCursor',
          'historyTrail',
        ]}
      />
      <main className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="space-y-6">
            <ApprovalFiltersBar
              filters={normalizedFilters}
              statusCatalog={statusCatalog}
              validationError={filterValidationError}
              exportCurrentPageHref={exportCurrentPageHref}
              exportAllHref={exportAllHref}
            />
            <ClaimAnalyticsCards
              columnsClassName="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
              cards={[
                {
                  label: 'Total Claims',
                  count: approvalAnalytics.total.count,
                  amount: approvalAnalytics.total.amount,
                  tone: 'neutral',
                },
                {
                  label: 'Pending Approvals',
                  count: approvalAnalytics.pendingApprovals.count,
                  amount: approvalAnalytics.pendingApprovals.amount,
                  tone: 'pending',
                },
                {
                  label: 'Approved Claims',
                  count: approvalAnalytics.approvedClaims.count,
                  amount: approvalAnalytics.approvedClaims.amount,
                  tone: 'approved',
                },
                {
                  label: 'Payment Released',
                  count: approvalAnalytics.paymentIssuedClaims.count,
                  amount: approvalAnalytics.paymentIssuedClaims.amount,
                  tone: 'finance',
                },
                {
                  label: 'Rejected Claims',
                  count: approvalAnalytics.rejectedClaims.count,
                  amount: approvalAnalytics.rejectedClaims.amount,
                  tone: 'rejected',
                },
              ]}
            />
            <ApprovalList
              approvals={approvals}
              pagination={{
                ...pendingPagination,
                pageSize: approvals.limit,
                totalPages: pendingTotalPages,
                totalItems: pendingTotalCount,
              }}
              dateSort={normalizedFilters.claimDateSort}
            />
            <ApprovalHistoryList
              history={history}
              showAmountColumn={showHistoryAmountColumn}
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
    </>
  )
}
