import type { SupabaseClient } from '@supabase/supabase-js'

import type { FinanceFilters } from '@/features/finance/types'
import { toIstDayEnd, toIstDayStart } from '@/features/finance/utils/filters'
import { isFinalApprovalLevel } from '@/lib/constants/approval-levels'

import { getFinanceQueueMetricsFilteredRpc } from '@/features/finance/data/rpc/finance-metrics.rpc'

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

function createMetricSummary(): ClaimMetricSummary {
  return { count: 0, amount: 0 }
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

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0)
}

// Phase 2: the claim scope (and the optional action-filter intersection) are resolved
// entirely inside get_finance_queue_metrics. The status-id derivation stays in TS
// (it queries the tiny claim_statuses table). No claim-ID array is built here.
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

  const pendingFinanceQueueStatusIds = activeStatuses
    .filter(
      (status) =>
        isFinalApprovalLevel(status.approval_level) &&
        !status.is_approval &&
        !status.is_rejection &&
        !status.is_terminal
    )
    .map((status) => status.id)

  const approvedStatusIds = activeStatuses
    .filter((status) => status.is_payment_issued)
    .map((status) => status.id)

  const rejectedStatusIds = activeStatuses
    .filter((status) => status.is_rejection)
    .map((status) => status.id)

  const analytics = createEmptyAnalytics()

  const hasFilters = hasActiveAnalyticsFilters(filters)
  const filterByFinanceActionDate =
    (filters.dateFilterField === 'finance_approved_date' ||
      filters.dateFilterField === 'payment_released_date') &&
    (filters.dateFrom || filters.dateTo)

  const useActionIntersect =
    hasFilters &&
    !!filters.actionFilter &&
    !filterByFinanceActionDate &&
    filters.actionFilter !== 'rejected_allow_reclaim'

  const useIst =
    filterByFinanceActionDate ||
    filters.dateFilterField === 'submitted_at' ||
    filters.dateFilterField === 'hod_approved_date'

  const metrics = await getFinanceQueueMetricsFilteredRpc(supabase, {
    p_pending_status_ids: pendingFinanceQueueStatusIds,
    p_approved_status_ids: approvedStatusIds,
    p_rejected_status_ids: rejectedStatusIds,
    p_has_filters: hasFilters,
    p_employee_id: filters.employeeId ?? null,
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
    p_action_intersect: useActionIntersect ? filters.actionFilter : null,
    p_action_from: useActionIntersect ? toIstDayStart(filters.dateFrom) : null,
    p_action_to: useActionIntersect ? toIstDayEnd(filters.dateTo) : null,
  })

  if (!metrics) {
    return analytics
  }

  return {
    total: {
      count: toNumber(metrics.total_count),
      amount: toNumber(metrics.total_amount),
    },
    pendingFinanceQueue: {
      count: toNumber(metrics.pending_count),
      amount: toNumber(metrics.pending_amount),
    },
    approved: {
      count: toNumber(metrics.approved_count),
      amount: toNumber(metrics.approved_amount),
    },
    rejected: {
      count: toNumber(metrics.rejected_count),
      amount: toNumber(metrics.rejected_amount),
    },
  }
}
