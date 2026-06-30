import type { SupabaseClient } from '@supabase/supabase-js'

import type { FinanceFilters } from '@/features/finance/types'
import { REJECTED_ALLOW_RECLAIM_ACTION_FILTER_VALUE } from '@/features/finance/utils/action-filter'
import {
  hasFinanceClaimFilters,
  toIstDayEnd,
  toIstDayStart,
} from '@/features/finance/utils/filters'

import { getFinanceHistoryMetricsFilteredRpc } from '@/features/finance/data/rpc/finance-metrics.rpc'

type ClaimMetricSummary = {
  count: number
  amount: number
}

type FinanceHistoryAnalytics = {
  total: ClaimMetricSummary
  approvedHistory: ClaimMetricSummary
  rejected: ClaimMetricSummary
  rejectedAllowReclaim: ClaimMetricSummary
  other: ClaimMetricSummary
}

const DEFAULT_FINANCE_FILTERS: FinanceFilters = {
  employeeId: null,
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

function createMetricSummary(): ClaimMetricSummary {
  return { count: 0, amount: 0 }
}

function createEmptyAnalytics(): FinanceHistoryAnalytics {
  return {
    total: createMetricSummary(),
    approvedHistory: createMetricSummary(),
    rejected: createMetricSummary(),
    rejectedAllowReclaim: createMetricSummary(),
    other: createMetricSummary(),
  }
}

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0)
}

// Phase 2: the claim scope and action classification are resolved entirely inside
// get_finance_history_metrics (Phase 1 resolver + finance_action_buckets). This
// function only converts date-only filter values to IST day boundaries — it never
// builds a claim-ID array in application memory.
export async function getFinanceHistoryAnalytics(
  supabase: SupabaseClient,
  filters: FinanceFilters = DEFAULT_FINANCE_FILTERS
): Promise<FinanceHistoryAnalytics> {
  const analytics = createEmptyAnalytics()

  const isActionDate =
    filters.dateFilterField === 'payment_released_date' ||
    filters.dateFilterField === 'finance_approved_date'
  const useIst =
    isActionDate ||
    filters.dateFilterField === 'submitted_at' ||
    filters.dateFilterField === 'hod_approved_date'

  const metrics = await getFinanceHistoryMetricsFilteredRpc(supabase, {
    p_has_filters: hasFinanceClaimFilters(filters),
    p_employee_id: filters.employeeId,
    p_employee_name: filters.employeeName,
    p_claim_number: filters.claimNumber,
    p_owner_designation: filters.ownerDesignation,
    p_hod_approver_emp: filters.hodApproverEmployeeId,
    p_claim_status: filters.claimStatus,
    p_work_location: filters.workLocation,
    p_action_filter: filters.actionFilter,
    p_date_field: filters.dateFilterField,
    p_date_from: useIst ? toIstDayStart(filters.dateFrom) : filters.dateFrom,
    p_date_to: useIst ? toIstDayEnd(filters.dateTo) : filters.dateTo,
  })

  if (!metrics) {
    return analytics
  }

  const isReclaimOnlyActionFilter =
    filters.actionFilter === REJECTED_ALLOW_RECLAIM_ACTION_FILTER_VALUE

  const rejectedWithoutReclaimCount =
    metrics.rejected_without_reclaim_count ??
    (isReclaimOnlyActionFilter ? 0 : metrics.rejected_count)
  const rejectedWithoutReclaimAmount =
    metrics.rejected_without_reclaim_amount ??
    (isReclaimOnlyActionFilter ? 0 : metrics.rejected_amount)
  const rejectedAllowReclaimCount =
    metrics.rejected_allow_reclaim_count ??
    (isReclaimOnlyActionFilter ? metrics.rejected_count : 0)
  const rejectedAllowReclaimAmount =
    metrics.rejected_allow_reclaim_amount ??
    (isReclaimOnlyActionFilter ? metrics.rejected_amount : 0)

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
      count: toNumber(rejectedWithoutReclaimCount),
      amount: toNumber(rejectedWithoutReclaimAmount),
    },
    rejectedAllowReclaim: {
      count: toNumber(rejectedAllowReclaimCount),
      amount: toNumber(rejectedAllowReclaimAmount),
    },
    other: {
      count: toNumber(metrics.other_count),
      amount: toNumber(metrics.other_amount),
    },
  }
}
