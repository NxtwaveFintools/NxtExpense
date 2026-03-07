import { redirect } from 'next/navigation'
import Link from 'next/link'

import { requireCurrentUser } from '@/features/auth/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import { getEmployeeByEmail } from '@/features/employees/queries'
import { isFinanceTeamMember } from '@/features/finance/permissions'
import {
  buildCursorNavigationLinks,
  decodeCursorTrail,
} from '@/lib/utils/pagination'
import {
  getFinanceHistoryAction,
  getFinanceQueueAction,
} from '@/features/finance/actions'
import { getClaimStatusCatalog } from '@/features/claims/queries'
import { getFinanceFilterOptions } from '@/features/finance/queries'
import { normalizeFinanceFilters } from '@/features/finance/utils/filters'
import { FinanceFiltersBar } from '@/features/finance/components/finance-filters-bar'
import { FinanceQueue } from '@/features/finance/components/finance-queue'
import { FinanceHistoryList } from '@/features/finance/components/finance-history-list'

type FinancePageProps = {
  searchParams?: Promise<{
    queueCursor?: string
    queueTrail?: string
    historyCursor?: string
    historyTrail?: string
    employeeName?: string
    claimNumber?: string
    ownerDesignation?: string
    hodApproverEmail?: string
    actionFilter?: string
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

  if (!employee || !isFinanceTeamMember(employee)) {
    redirect('/dashboard')
  }

  const resolvedSearch = await searchParams
  const rawFilters = {
    employeeName: resolvedSearch?.employeeName,
    claimNumber: resolvedSearch?.claimNumber,
    ownerDesignation: resolvedSearch?.ownerDesignation,
    hodApproverEmail: resolvedSearch?.hodApproverEmail,
    actionFilter: resolvedSearch?.actionFilter,
    claimDateFrom: resolvedSearch?.claimDateFrom,
    claimDateTo: resolvedSearch?.claimDateTo,
    actionDateFrom: resolvedSearch?.actionDateFrom,
    actionDateTo: resolvedSearch?.actionDateTo,
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
    hodApproverEmail: normalizedFilters.hodApproverEmail ?? undefined,
    actionFilter: normalizedFilters.actionFilter,
    claimDateFrom: normalizedFilters.claimDateFrom ?? undefined,
    claimDateTo: normalizedFilters.claimDateTo ?? undefined,
    actionDateFrom: normalizedFilters.actionDateFrom ?? undefined,
    actionDateTo: normalizedFilters.actionDateTo ?? undefined,
  }

  const queueCursor = resolvedSearch?.queueCursor ?? null
  const queueTrail = decodeCursorTrail(resolvedSearch?.queueTrail ?? null)
  const historyCursor = resolvedSearch?.historyCursor ?? null
  const historyTrail = decodeCursorTrail(resolvedSearch?.historyTrail ?? null)

  const [queue, history, statusCatalog, filterOptions] = await Promise.all([
    getFinanceQueueAction(queueCursor, 10, normalizedFilterParams),
    getFinanceHistoryAction(historyCursor, 10, normalizedFilterParams),
    getClaimStatusCatalog(supabase),
    getFinanceFilterOptions(supabase),
  ])

  const queuePagination = buildCursorNavigationLinks({
    pathname: '/finance',
    query: resolvedSearch,
    cursorKey: 'queueCursor',
    trailKey: 'queueTrail',
    currentCursor: queueCursor,
    currentTrail: queueTrail,
    nextCursor: queue.nextCursor,
  })

  const historyPagination = buildCursorNavigationLinks({
    pathname: '/finance',
    query: resolvedSearch,
    cursorKey: 'historyCursor',
    trailKey: 'historyTrail',
    currentCursor: historyCursor,
    currentTrail: historyTrail,
    nextCursor: history.nextCursor,
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
        <div className="space-y-6">
          <FinanceFiltersBar
            filters={normalizedFilters}
            options={filterOptions}
          />
          <FinanceQueue queue={queue} pagination={queuePagination} />
          <FinanceHistoryList
            history={history}
            statusCatalog={statusCatalog}
            pagination={historyPagination}
          />
        </div>
      </div>
    </main>
  )
}
