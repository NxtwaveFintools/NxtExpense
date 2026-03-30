import type { SupabaseClient } from '@supabase/supabase-js'

import type { PendingApprovalsFilters } from '@/features/approvals/types'
import { getPendingApprovalsSummary } from '@/features/approvals/queries/pending-summary'
import { getLocationIdsByApprovalLocationType } from '@/features/approvals/queries/location-type'
import { parseClaimStatusFilterValue } from '@/lib/utils/claim-status-filter'

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

type ApprovalActionRow = {
  claim_id: string
  action: string
  acted_at: string
}

type ClaimAmountRow = {
  id: string
  total_amount: number | string
  status_id: string
  allow_resubmit: boolean
}

type ClaimStatusRow = {
  id: string
  is_payment_issued: boolean
}

const DEFAULT_PENDING_FILTERS: PendingApprovalsFilters = {
  employeeName: null,
  claimStatus: null,
  claimDateFrom: null,
  claimDateTo: null,
  amountOperator: 'lte',
  amountValue: null,
  locationType: null,
  claimDateSort: 'desc',
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

async function resolveLocationIds(
  supabase: SupabaseClient,
  locationType: PendingApprovalsFilters['locationType']
): Promise<string[] | null> {
  return getLocationIdsByApprovalLocationType(supabase, locationType)
}

async function getFilteredClaimsByIds(
  supabase: SupabaseClient,
  claimIds: string[],
  filters: PendingApprovalsFilters,
  scopedLocationIds: string[] | null
): Promise<ClaimAmountRow[]> {
  if (claimIds.length === 0) {
    return []
  }

  let query = supabase
    .from('expense_claims')
    .select(
      'id, total_amount, status_id, allow_resubmit, employees!employee_id!inner(employee_name)'
    )
    .in('id', claimIds)

  const parsedStatusFilter = parseClaimStatusFilterValue(filters.claimStatus)

  if (parsedStatusFilter) {
    query = query.eq('status_id', parsedStatusFilter.statusId)

    if (parsedStatusFilter.allowResubmitOnly) {
      query = query.eq('allow_resubmit', true)
    }
  }

  if (filters.claimDateFrom) {
    query = query.gte('claim_date', filters.claimDateFrom)
  }

  if (filters.claimDateTo) {
    query = query.lte('claim_date', filters.claimDateTo)
  }

  if (filters.amountValue !== null) {
    if (filters.amountOperator === 'gte') {
      query = query.gte('total_amount', filters.amountValue)
    } else if (filters.amountOperator === 'eq') {
      query = query.eq('total_amount', filters.amountValue)
    } else {
      query = query.lte('total_amount', filters.amountValue)
    }
  }

  const normalizedName = filters.employeeName?.trim() ?? ''
  if (normalizedName) {
    const escapedName = normalizedName
      .replaceAll('%', '\\%')
      .replaceAll('_', '\\_')
    query = query.ilike('employees.employee_name', `%${escapedName}%`)
  }

  if (scopedLocationIds) {
    if (scopedLocationIds.length === 0) {
      return []
    }

    query = query.in('work_location_id', scopedLocationIds)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ClaimAmountRow[]
}

export async function getApprovalStageAnalytics(
  supabase: SupabaseClient,
  approverEmail: string,
  filters: PendingApprovalsFilters = DEFAULT_PENDING_FILTERS
): Promise<ApprovalAnalytics> {
  const analytics = createEmptyAnalytics()

  analytics.pendingApprovals = await getPendingApprovalsSummary(
    supabase,
    approverEmail,
    filters
  )

  const { data: actorRow, error: actorError } = await supabase
    .from('employees')
    .select('id')
    .eq('employee_email', approverEmail.toLowerCase())
    .maybeSingle()

  if (actorError) {
    throw new Error(actorError.message)
  }

  if (!actorRow) {
    analytics.total.count = analytics.pendingApprovals.count
    analytics.total.amount = analytics.pendingApprovals.amount
    return analytics
  }

  const { data: statusRows, error: statusError } = await supabase
    .from('claim_statuses')
    .select('id, is_payment_issued')
    .eq('is_active', true)

  if (statusError) {
    throw new Error(statusError.message)
  }

  const paymentIssuedStatusIds = new Set(
    ((statusRows ?? []) as ClaimStatusRow[])
      .filter((status) => status.is_payment_issued)
      .map((status) => status.id)
  )

  const { data: actionRows, error: actionError } = await supabase
    .from('approval_history')
    .select('claim_id, action, acted_at')
    .eq('approver_employee_id', actorRow.id)
    .in('action', ['approved', 'rejected'])
    .order('acted_at', { ascending: false })

  if (actionError) {
    throw new Error(actionError.message)
  }

  const latestActionByClaim = new Map<string, 'approved' | 'rejected'>()

  for (const row of (actionRows ?? []) as ApprovalActionRow[]) {
    if (!latestActionByClaim.has(row.claim_id)) {
      if (row.action === 'approved' || row.action === 'rejected') {
        latestActionByClaim.set(row.claim_id, row.action)
      }
    }
  }

  if (latestActionByClaim.size === 0) {
    analytics.total.count = analytics.pendingApprovals.count
    analytics.total.amount = analytics.pendingApprovals.amount
    return analytics
  }

  const scopedLocationIds = await resolveLocationIds(
    supabase,
    filters.locationType
  )

  if (scopedLocationIds && scopedLocationIds.length === 0) {
    analytics.total.count = analytics.pendingApprovals.count
    analytics.total.amount = analytics.pendingApprovals.amount
    return analytics
  }

  const filteredClaims = await getFilteredClaimsByIds(
    supabase,
    [...latestActionByClaim.keys()],
    filters,
    scopedLocationIds
  )

  for (const claim of filteredClaims) {
    const action = latestActionByClaim.get(claim.id)
    const amount = Number(claim.total_amount ?? 0)

    if (action === 'approved') {
      analytics.approvedClaims.count += 1
      analytics.approvedClaims.amount += amount

      if (paymentIssuedStatusIds.has(claim.status_id)) {
        analytics.paymentIssuedClaims.count += 1
        analytics.paymentIssuedClaims.amount += amount
      }

      continue
    }

    if (action === 'rejected') {
      analytics.rejectedClaims.count += 1
      analytics.rejectedClaims.amount += amount
    }
  }

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
