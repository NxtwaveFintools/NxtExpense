import type { SupabaseClient } from '@supabase/supabase-js'

import type { FinanceFilters } from '@/features/finance/types'
import { getFilteredClaimIdsForFinance } from '@/features/finance/queries/filters'
import { toIstDayEnd, toIstDayStart } from '@/features/finance/utils/filters'

type ClaimMetricSummary = {
  count: number
  amount: number
}

const DEFAULT_FINANCE_FILTERS: FinanceFilters = {
  employeeName: null,
  claimNumber: null,
  ownerDesignation: null,
  hodApproverEmployeeId: null,
  claimStatus: null,
  workLocation: null,
  actionFilter: null,
  dateFilterField: 'claim_date',
  dateFrom: null,
  dateTo: null,
}

type FinanceQueueAnalytics = {
  total: ClaimMetricSummary
  pendingFinanceQueue: ClaimMetricSummary
  approved: ClaimMetricSummary
  rejected: ClaimMetricSummary
}

type ClaimStatusRow = {
  id: string
  approval_level: number | null
  is_approval: boolean
  is_rejection: boolean
  is_terminal: boolean
  is_payment_issued: boolean
}

type ClaimSummaryRow = {
  id: string
  created_at: string
  status_id: string
  total_amount: number | string
}

function createMetricSummary(): ClaimMetricSummary {
  return { count: 0, amount: 0 }
}

function addToMetric(metric: ClaimMetricSummary, amount: number) {
  metric.count += 1
  metric.amount += amount
}

function createEmptyAnalytics(): FinanceQueueAnalytics {
  return {
    total: createMetricSummary(),
    pendingFinanceQueue: createMetricSummary(),
    approved: createMetricSummary(),
    rejected: createMetricSummary(),
  }
}

function hasActiveAnalyticsFilters(filters: FinanceFilters): boolean {
  return Boolean(
    filters.employeeName ||
    filters.claimNumber ||
    filters.ownerDesignation ||
    filters.hodApproverEmployeeId ||
    filters.claimStatus ||
    filters.workLocation ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.actionFilter
  )
}

function toClaimIdSet(rows: Array<{ claim_id: string }>): Set<string> {
  return new Set(rows.map((row) => row.claim_id))
}

function intersectClaimIds(
  scopedClaimIds: string[] | null,
  candidateClaimIds: Set<string>
): string[] {
  if (scopedClaimIds === null) {
    return [...candidateClaimIds]
  }

  return scopedClaimIds.filter((claimId) => candidateClaimIds.has(claimId))
}

function buildCursorFilter(createdAt: string, id: string): string {
  return `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`
}

export async function getFinanceQueueAnalytics(
  supabase: SupabaseClient,
  filters: FinanceFilters = DEFAULT_FINANCE_FILTERS
): Promise<FinanceQueueAnalytics> {
  const { data: statusRows, error: statusError } = await supabase
    .from('claim_statuses')
    .select(
      'id, approval_level, is_approval, is_rejection, is_terminal, is_payment_issued'
    )
    .eq('is_active', true)

  if (statusError) {
    throw new Error(statusError.message)
  }

  const activeStatuses = (statusRows ?? []) as ClaimStatusRow[]

  const pendingFinanceQueueStatusIds = new Set(
    activeStatuses
      .filter(
        (status) =>
          status.approval_level === 3 &&
          !status.is_approval &&
          !status.is_rejection &&
          !status.is_terminal
      )
      .map((status) => status.id)
  )

  const approvedStatusIds = new Set(
    activeStatuses
      .filter((status) => status.is_payment_issued)
      .map((status) => status.id)
  )

  const rejectedStatusIds = new Set(
    activeStatuses
      .filter((status) => status.is_rejection)
      .map((status) => status.id)
  )

  const analytics = createEmptyAnalytics()

  let scopedClaimIds: string[] | null = null
  const filterByApprovedDate =
    filters.dateFilterField === 'finance_approved_date' &&
    (filters.dateFrom || filters.dateTo)

  if (hasActiveAnalyticsFilters(filters)) {
    const filteredClaimIds = await getFilteredClaimIdsForFinance(
      supabase,
      filters
    )

    if (Array.isArray(filteredClaimIds) && filteredClaimIds.length === 0) {
      return analytics
    }

    scopedClaimIds = filteredClaimIds

    if (filters.actionFilter && !filterByApprovedDate) {
      let financeActionQuery = supabase
        .from('finance_actions')
        .select('claim_id')
        .eq('action', filters.actionFilter)

      const dateFrom = toIstDayStart(filters.dateFrom)
      const dateTo = toIstDayEnd(filters.dateTo)

      if (dateFrom) {
        financeActionQuery = financeActionQuery.gte('acted_at', dateFrom)
      }

      if (dateTo) {
        financeActionQuery = financeActionQuery.lte('acted_at', dateTo)
      }

      const { data: financeActionRows, error: financeActionError } =
        await financeActionQuery

      if (financeActionError) {
        throw new Error(financeActionError.message)
      }

      const actionClaimIdSet = toClaimIdSet(financeActionRows ?? [])
      scopedClaimIds = intersectClaimIds(scopedClaimIds, actionClaimIdSet)

      if (scopedClaimIds.length === 0) {
        return analytics
      }
    }
  }

  const pageSize = 500
  let nextCursor: { created_at: string; id: string } | null = null

  for (;;) {
    let query = supabase
      .from('expense_claims')
      .select('id, created_at, status_id, total_amount')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize)

    if (Array.isArray(scopedClaimIds)) {
      query = query.in('id', scopedClaimIds)
    }

    if (nextCursor) {
      query = query.or(buildCursorFilter(nextCursor.created_at, nextCursor.id))
    }

    const { data, error } = await query

    if (error) {
      throw new Error(error.message)
    }

    const rows = (data ?? []) as ClaimSummaryRow[]

    if (rows.length === 0) {
      break
    }

    for (const row of rows) {
      const amount = Number(row.total_amount ?? 0)
      addToMetric(analytics.total, amount)

      if (pendingFinanceQueueStatusIds.has(row.status_id)) {
        addToMetric(analytics.pendingFinanceQueue, amount)
        continue
      }

      if (approvedStatusIds.has(row.status_id)) {
        addToMetric(analytics.approved, amount)
        continue
      }

      if (rejectedStatusIds.has(row.status_id)) {
        addToMetric(analytics.rejected, amount)
      }
    }

    if (rows.length < pageSize) {
      break
    }

    const lastRow = rows[rows.length - 1]
    nextCursor = {
      created_at: lastRow.created_at,
      id: lastRow.id,
    }
  }

  return analytics
}
