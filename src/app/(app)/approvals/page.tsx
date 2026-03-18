import { requireCurrentUser } from '@/features/auth/queries'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { canAccessApprovals } from '@/features/employees/permissions'
import { getClaimStatusCatalog } from '@/features/claims/queries'
import {
  getEmployeeByEmail,
  hasApproverAssignments,
} from '@/lib/services/employee-service'
import {
  buildCursorNavigationLinks,
  decodeCursorTrail,
  encodeCursorTrail,
} from '@/lib/utils/pagination'
import {
  addApprovalFiltersToParams,
  normalizeApprovalHistoryFilters,
} from '@/features/approvals/utils/history-filters'
import { canViewApprovalHistoryAmount } from '@/features/approvals/utils/amount-visibility'
import {
  buildPathWithSearchParams,
  createNonEmptySearchParams,
  toSortedQueryString,
} from '@/lib/utils/search-params'

import {
  getApprovalHistoryAction,
  getPendingApprovalsAction,
} from '@/features/approvals/actions'
import { getPendingApprovalsSummary } from '@/features/approvals/queries/pending-summary'
import { ApprovalList } from '@/features/approvals/components/approval-list'
import { ApprovalFiltersBar } from '@/features/approvals/components/approval-filters-bar'
import { ApprovalHistoryList } from '@/features/approvals/components/approval-history-list'
import { ClaimAnalyticsCards } from '@/components/ui/claim-analytics-cards'

type ApprovalsPageProps = {
  searchParams?: Promise<{
    pendingCursor?: string
    pendingTrail?: string
    historyCursor?: string
    historyTrail?: string
    claimStatus?: string
    employeeName?: string
    claimDate?: string
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
    claimDate: resolvedSearch?.claimDate,
    hodApprovedFrom: resolvedSearch?.hodApprovedFrom,
    hodApprovedTo: resolvedSearch?.hodApprovedTo,
    financeApprovedFrom: resolvedSearch?.financeApprovedFrom,
    financeApprovedTo: resolvedSearch?.financeApprovedTo,
  }
  const normalizedFilters = (() => {
    try {
      return normalizeApprovalHistoryFilters(rawFilters)
    } catch {
      return {
        claimStatus: null,
        employeeName: null,
        claimDate: null,
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
    claimDate: normalizedFilters.claimDate ?? undefined,
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
    toSortedQueryString(currentParams) !== toSortedQueryString(canonicalParams)
  ) {
    redirect(buildPathWithSearchParams('/approvals', canonicalParams))
  }

  const paginationQuery = Object.fromEntries(canonicalParams.entries())

  const [approvals, history, statusCatalog, pendingSummary] = await Promise.all(
    [
      getPendingApprovalsAction(pendingCursor, 10, normalizedFilterParams),
      getApprovalHistoryAction(historyCursor, 10, normalizedFilterParams),
      getClaimStatusCatalog(supabase),
      getPendingApprovalsSummary(supabase, user.email ?? '', {
        employeeName: normalizedFilters.employeeName,
        claimStatus: normalizedFilters.claimStatus,
      }),
    ]
  )

  const showHistoryAmountColumn = canViewApprovalHistoryAmount(
    employee.designations?.designation_name
  )

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
      <main className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="space-y-6">
            <ApprovalFiltersBar
              filters={normalizedFilters}
              statusCatalog={statusCatalog}
              exportCurrentPageHref={exportCurrentPageHref}
              exportAllHref={exportAllHref}
            />
            <ClaimAnalyticsCards
              columnsClassName="grid grid-cols-1"
              cards={[
                {
                  label: 'Pending Approvals',
                  count: pendingSummary.count,
                  amount: pendingSummary.amount,
                  tone: 'pending',
                },
              ]}
            />
            <ApprovalList
              approvals={approvals}
              pagination={pendingPagination}
            />
            <ApprovalHistoryList
              history={history}
              showAmountColumn={showHistoryAmountColumn}
              pagination={historyPagination}
            />
          </div>
        </div>
      </main>
    </>
  )
}
