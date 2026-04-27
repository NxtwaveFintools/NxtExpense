import type { SupabaseClient } from '@supabase/supabase-js'

import type { ApprovalHistoryFilters } from '@/features/approvals/types'
import { getPendingApprovalsSummary } from '@/features/approvals/queries/pending-summary'
import { parseClaimStatusFilterValue } from '@/lib/utils/claim-status-filter'
import { resolveClaimAllowResubmitFilterValue } from '@/lib/services/claim-status-filter-service'

type ClaimMetricSummary = {
  count: number
  amount: number
}

type ApprovalAnalytics = {
  total: ClaimMetricSummary
  pendingApprovals: ClaimMetricSummary
  approvedClaims: ClaimMetricSummary
  paymentIssuedClaims: ClaimMetricSummary
  rejectedClaims: ClaimMetricSummary
}

type ApprovalHistoryAnalyticsRow = {
  approved_count: number | string | null
  approved_amount: number | string | null
  payment_issued_count: number | string | null
  payment_issued_amount: number | string | null
  rejected_count: number | string | null
  rejected_amount: number | string | null
}

const DEFAULT_APPROVAL_ANALYTICS_FILTERS: ApprovalHistoryFilters = {
  employeeName: null,
  claimStatus: null,
  claimDateFrom: null,
  claimDateTo: null,
  amountOperator: 'lte',
  amountValue: null,
  locationType: null,
  claimDateSort: 'desc',
  hodApprovedFrom: null,
  hodApprovedTo: null,
  financeApprovedFrom: null,
  financeApprovedTo: null,
}

function createMetricSummary(): ClaimMetricSummary {
  return {
    count: 0,
    amount: 0,
  }
}

function createEmptyAnalytics(): ApprovalAnalytics {
  return {
    total: createMetricSummary(),
    pendingApprovals: createMetricSummary(),
    approvedClaims: createMetricSummary(),
    paymentIssuedClaims: createMetricSummary(),
    rejectedClaims: createMetricSummary(),
  }
}

function sumMetric(metric: ClaimMetricSummary): number {
  return metric.amount
}

function toMetricValue(value: number | string | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return 0
}

async function getApprovalHistoryAnalyticsSummary(
  supabase: SupabaseClient,
  filters: ApprovalHistoryFilters
): Promise<
  Pick<
    ApprovalAnalytics,
    'approvedClaims' | 'paymentIssuedClaims' | 'rejectedClaims'
  >
> {
  const parsedStatusFilter = parseClaimStatusFilterValue(filters.claimStatus)
  const allowResubmitFilter = await resolveClaimAllowResubmitFilterValue(
    supabase,
    parsedStatusFilter
  )

  const { data, error } = await supabase.rpc('get_approval_history_analytics', {
    p_name_search: filters.employeeName,
    p_claim_status_id: parsedStatusFilter?.statusId ?? null,
    p_claim_allow_resubmit: allowResubmitFilter,
    p_amount_operator: filters.amountOperator,
    p_amount_value: filters.amountValue,
    p_location_type: filters.locationType,
    p_claim_date_from: filters.claimDateFrom,
    p_claim_date_to: filters.claimDateTo,
    p_hod_approved_from: filters.hodApprovedFrom,
    p_hod_approved_to: filters.hodApprovedTo,
    p_finance_approved_from: filters.financeApprovedFrom,
    p_finance_approved_to: filters.financeApprovedTo,
  })

  if (error) {
    throw new Error(error.message)
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | ApprovalHistoryAnalyticsRow
    | null
    | undefined

  return {
    approvedClaims: {
      count: toMetricValue(row?.approved_count),
      amount: toMetricValue(row?.approved_amount),
    },
    paymentIssuedClaims: {
      count: toMetricValue(row?.payment_issued_count),
      amount: toMetricValue(row?.payment_issued_amount),
    },
    rejectedClaims: {
      count: toMetricValue(row?.rejected_count),
      amount: toMetricValue(row?.rejected_amount),
    },
  }
}

export async function getApprovalStageAnalytics(
  supabase: SupabaseClient,
  approverEmail: string,
  filters: ApprovalHistoryFilters = DEFAULT_APPROVAL_ANALYTICS_FILTERS
): Promise<ApprovalAnalytics> {
  const analytics = createEmptyAnalytics()

  const [pendingApprovals, historySummary] = await Promise.all([
    getPendingApprovalsSummary(supabase, approverEmail, filters),
    getApprovalHistoryAnalyticsSummary(supabase, filters),
  ])

  analytics.pendingApprovals = pendingApprovals
  analytics.approvedClaims = historySummary.approvedClaims
  analytics.paymentIssuedClaims = historySummary.paymentIssuedClaims
  analytics.rejectedClaims = historySummary.rejectedClaims

  analytics.total.count =
    analytics.pendingApprovals.count +
    analytics.approvedClaims.count +
    analytics.rejectedClaims.count
  analytics.total.amount =
    sumMetric(analytics.pendingApprovals) +
    sumMetric(analytics.approvedClaims) +
    sumMetric(analytics.rejectedClaims)

  return analytics
}
