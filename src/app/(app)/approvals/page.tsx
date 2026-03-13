import { requireCurrentUser } from '@/features/auth/queries'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { canAccessApprovals } from '@/features/employees/permissions'
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
import {
  buildPathWithSearchParams,
  createNonEmptySearchParams,
  toSortedQueryString,
} from '@/lib/utils/search-params'

import {
  getApprovalHistoryAction,
  getPendingApprovalsAction,
} from '@/features/approvals/actions'
import { ApprovalList } from '@/features/approvals/components/approval-list'
import { ApprovalFiltersBar } from '@/features/approvals/components/approval-filters-bar'
import { ApprovalHistoryList } from '@/features/approvals/components/approval-history-list'

type ApprovalsPageProps = {
  searchParams?: Promise<{
    pendingCursor?: string
    pendingTrail?: string
    historyCursor?: string
    historyTrail?: string
    employeeName?: string
    actorFilter?: string
    claimDate?: string
    claimDateFrom?: string
    claimDateTo?: string
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
  const legacyClaimDate =
    resolvedSearch?.claimDateFrom && resolvedSearch?.claimDateTo
      ? resolvedSearch.claimDateFrom === resolvedSearch.claimDateTo
        ? resolvedSearch.claimDateFrom
        : undefined
      : (resolvedSearch?.claimDateFrom ?? resolvedSearch?.claimDateTo)

  const rawFilters = {
    employeeName: resolvedSearch?.employeeName,
    actorFilter: resolvedSearch?.actorFilter,
    claimDate: resolvedSearch?.claimDate ?? legacyClaimDate,
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
        employeeName: null,
        actorFilter: 'all' as const,
        claimDate: null,
        hodApprovedFrom: null,
        hodApprovedTo: null,
        financeApprovedFrom: null,
        financeApprovedTo: null,
      }
    }
  })()

  const normalizedFilterParams = {
    employeeName: normalizedFilters.employeeName ?? undefined,
    actorFilter: normalizedFilters.actorFilter,
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

  const [approvals, history] = await Promise.all([
    getPendingApprovalsAction(pendingCursor, 10, normalizedFilterParams),
    getApprovalHistoryAction(historyCursor, 10, normalizedFilterParams),
  ])

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
              exportCurrentPageHref={exportCurrentPageHref}
              exportAllHref={exportAllHref}
            />
            <ApprovalList
              approvals={approvals}
              pagination={pendingPagination}
            />
            <ApprovalHistoryList
              history={history}
              pagination={historyPagination}
            />
          </div>
        </div>
      </main>
    </>
  )
}
