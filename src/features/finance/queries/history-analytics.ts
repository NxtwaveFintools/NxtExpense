import type { SupabaseClient } from '@supabase/supabase-js'

import type { FinanceFilters } from '@/features/finance/types'
import {
  getFilteredClaimIdsForFinance,
  isFinanceActionDateFilterField,
} from '@/features/finance/queries/filters'
import { toIstDayEnd, toIstDayStart } from '@/features/finance/utils/filters'

type ClaimMetricSummary = {
  count: number
  amount: number
}

type FinanceHistoryAnalytics = {
  total: ClaimMetricSummary
  approvedHistory: ClaimMetricSummary
  rejected: ClaimMetricSummary
  other: ClaimMetricSummary
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

type FinanceActionTransitionRow = {
  action_code: string
  to_status_id: string
}

type ClaimStatusRow = {
  id: string
  approval_level: number | null
  is_approval: boolean
  is_rejection: boolean
  is_terminal: boolean
  is_payment_issued: boolean
}

type FinanceHistoryAnalyticsRow = {
  id: string
  action: string
  acted_at: string
  claim:
    | { total_amount: number | string }
    | Array<{ total_amount: number | string }>
    | null
}

function createMetricSummary(): ClaimMetricSummary {
  return { count: 0, amount: 0 }
}

function createEmptyAnalytics(): FinanceHistoryAnalytics {
  return {
    total: createMetricSummary(),
    approvedHistory: createMetricSummary(),
    rejected: createMetricSummary(),
    other: createMetricSummary(),
  }
}

function addToMetric(metric: ClaimMetricSummary, amount: number) {
  metric.count += 1
  metric.amount += amount
}

function normalizeFinanceHistoryActionCode(
  actionCode: string,
  toStatusId: string,
  paymentIssuedStatusIds: Set<string>
): string {
  if (
    paymentIssuedStatusIds.has(toStatusId) &&
    actionCode.startsWith('finance_')
  ) {
    return actionCode.slice('finance_'.length)
  }

  return actionCode
}

function buildActionCursorFilter(actedAt: string, id: string): string {
  return `acted_at.lt.${actedAt},and(acted_at.eq.${actedAt},id.lt.${id})`
}

async function getFinanceActionBuckets(supabase: SupabaseClient): Promise<{
  financeApprovedActions: Set<string>
  paymentReleasedActions: Set<string>
  approvedActions: Set<string>
  rejectedActions: Set<string>
}> {
  const [statusResult, transitionResult] = await Promise.all([
    supabase
      .from('claim_statuses')
      .select(
        'id, approval_level, is_approval, is_rejection, is_terminal, is_payment_issued'
      )
      .eq('is_active', true),
    supabase
      .from('claim_status_transitions')
      .select('action_code, to_status_id')
      .eq('is_active', true),
  ])

  if (statusResult.error) {
    throw new Error(statusResult.error.message)
  }

  if (transitionResult.error) {
    throw new Error(transitionResult.error.message)
  }

  const statusRows = (statusResult.data ?? []) as ClaimStatusRow[]
  const transitionRows = (transitionResult.data ??
    []) as FinanceActionTransitionRow[]

  const paymentIssuedStatusIds = new Set(
    statusRows.filter((row) => row.is_payment_issued).map((row) => row.id)
  )
  const rejectedStatusIds = new Set(
    statusRows.filter((row) => row.is_rejection).map((row) => row.id)
  )
  const financeApprovedStatusIds = new Set(
    statusRows
      .filter(
        (row) =>
          row.is_approval &&
          !row.is_rejection &&
          !row.is_terminal &&
          !row.is_payment_issued &&
          row.approval_level === null
      )
      .map((row) => row.id)
  )

  const financeApprovedActions = new Set<string>()
  const paymentReleasedActions = new Set<string>()
  const approvedActions = new Set<string>()
  const rejectedActions = new Set<string>()

  for (const row of transitionRows) {
    const normalized = normalizeFinanceHistoryActionCode(
      row.action_code,
      row.to_status_id,
      paymentIssuedStatusIds
    )

    if (financeApprovedStatusIds.has(row.to_status_id)) {
      financeApprovedActions.add(row.action_code)
      approvedActions.add(row.action_code)
    }

    if (paymentIssuedStatusIds.has(row.to_status_id)) {
      paymentReleasedActions.add(normalized)
      approvedActions.add(normalized)
    }

    if (rejectedStatusIds.has(row.to_status_id)) {
      rejectedActions.add(normalized)
    }
  }

  return {
    financeApprovedActions,
    paymentReleasedActions,
    approvedActions,
    rejectedActions,
  }
}

export async function getFinanceHistoryAnalytics(
  supabase: SupabaseClient,
  filters: FinanceFilters = DEFAULT_FINANCE_FILTERS
): Promise<FinanceHistoryAnalytics> {
  const analytics = createEmptyAnalytics()
  const filteredClaimIds = await getFilteredClaimIdsForFinance(
    supabase,
    filters
  )

  if (Array.isArray(filteredClaimIds) && filteredClaimIds.length === 0) {
    return analytics
  }

  const filterByFinanceActionDate =
    isFinanceActionDateFilterField(filters.dateFilterField) &&
    (filters.dateFrom || filters.dateTo)

  const {
    approvedActions,
    rejectedActions,
    financeApprovedActions,
    paymentReleasedActions,
  } = await getFinanceActionBuckets(supabase)

  const dateScopedActions =
    filters.dateFilterField === 'finance_approved_date'
      ? financeApprovedActions
      : paymentReleasedActions

  if (filterByFinanceActionDate && dateScopedActions.size === 0) {
    return analytics
  }

  const pageSize = 500
  let nextCursor: { acted_at: string; id: string } | null = null

  for (;;) {
    let query = supabase
      .from('finance_actions')
      .select('id, action, acted_at, claim:expense_claims!inner(total_amount)')
      .order('acted_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize)

    if (filterByFinanceActionDate) {
      query = query.in('action', [...dateScopedActions])

      const dateFrom = toIstDayStart(filters.dateFrom)
      const dateTo = toIstDayEnd(filters.dateTo)

      if (dateFrom) {
        query = query.gte('acted_at', dateFrom)
      }

      if (dateTo) {
        query = query.lte('acted_at', dateTo)
      }
    } else if (filters.actionFilter) {
      query = query.eq('action', filters.actionFilter)
    }

    if (Array.isArray(filteredClaimIds)) {
      query = query.in('claim_id', filteredClaimIds)
    }

    if (nextCursor) {
      query = query.or(
        buildActionCursorFilter(nextCursor.acted_at, nextCursor.id)
      )
    }

    const { data, error } = await query

    if (error) {
      throw new Error(error.message)
    }

    const rows = (data ?? []) as FinanceHistoryAnalyticsRow[]

    if (rows.length === 0) {
      break
    }

    for (const row of rows) {
      const claim = Array.isArray(row.claim) ? row.claim[0] : row.claim
      const amount = Number(claim?.total_amount ?? 0)

      addToMetric(analytics.total, amount)

      if (approvedActions.has(row.action)) {
        addToMetric(analytics.approvedHistory, amount)
        continue
      }

      if (rejectedActions.has(row.action)) {
        addToMetric(analytics.rejected, amount)
        continue
      }

      addToMetric(analytics.other, amount)
    }

    if (rows.length < pageSize) {
      break
    }

    const lastRow = rows[rows.length - 1]
    nextCursor = {
      acted_at: lastRow.acted_at,
      id: lastRow.id,
    }
  }

  return analytics
}
