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

type FinanceHistoryMetricsRow = {
  total_count: number | string | null
  total_amount: number | string | null
  approved_count: number | string | null
  approved_amount: number | string | null
  rejected_count: number | string | null
  rejected_amount: number | string | null
  other_count: number | string | null
  other_amount: number | string | null
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

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0)
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

  const { data: metricsData, error: metricsError } = await supabase.rpc(
    'get_finance_history_action_metrics',
    {
      p_claim_ids: Array.isArray(filteredClaimIds) ? filteredClaimIds : null,
      p_action_filter: filterByFinanceActionDate ? null : filters.actionFilter,
      p_date_from: filterByFinanceActionDate
        ? toIstDayStart(filters.dateFrom)
        : null,
      p_date_to: filterByFinanceActionDate ? toIstDayEnd(filters.dateTo) : null,
      p_date_scoped_actions: filterByFinanceActionDate
        ? [...dateScopedActions]
        : null,
      p_approved_actions: [...approvedActions],
      p_rejected_actions: [...rejectedActions],
    }
  )

  if (metricsError) {
    throw new Error(metricsError.message)
  }

  const metrics = (
    Array.isArray(metricsData) ? metricsData[0] : metricsData
  ) as FinanceHistoryMetricsRow | null

  if (!metrics) {
    return analytics
  }

  return {
    total: {
      count: toNumber(metrics.total_count),
      amount: toNumber(metrics.total_amount),
    },
    approvedHistory: {
      count: toNumber(metrics.approved_count),
      amount: toNumber(metrics.approved_amount),
    },
    rejected: {
      count: toNumber(metrics.rejected_count),
      amount: toNumber(metrics.rejected_amount),
    },
    other: {
      count: toNumber(metrics.other_count),
      amount: toNumber(metrics.other_amount),
    },
  }
}
