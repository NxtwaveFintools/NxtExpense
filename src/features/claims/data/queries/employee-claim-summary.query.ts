import type { SupabaseClient } from '@supabase/supabase-js'

import { getClaimStatusDisplay } from '@/lib/utils/claim-status'

import {
  getEmployeeClaimMetrics,
  type EmployeeClaimMetricsRow,
} from '@/features/claims/data/rpc/claim-metrics.rpc'

type ClaimMetricSummary = {
  count: number
  amount: number
}

export type DashboardClaimStats = {
  total: ClaimMetricSummary
  pending: ClaimMetricSummary
  approved: ClaimMetricSummary
  rejected: ClaimMetricSummary
  rejectedAllowReclaim: ClaimMetricSummary
}

export type DashboardRecentClaim = {
  id: string
  claim_number: string | null
  claim_date: string
  total_amount: number
  statusName: string
  displayColor: string
}

export type ProfileClaimStats = {
  total: number
  pending: number
  financeApproved: number
  rejected: number
  paymentReleased: number
}

type RecentClaimRow = {
  id: string
  claim_number: string | null
  claim_date: string
  total_amount: number | string | null
  allow_resubmit: boolean | null
  claim_statuses:
    | {
        status_code: string | null
        status_name: string | null
        display_color: string | null
        allow_resubmit_status_name: string | null
        allow_resubmit_display_color: string | null
      }
    | Array<{
        status_code: string | null
        status_name: string | null
        display_color: string | null
        allow_resubmit_status_name: string | null
        allow_resubmit_display_color: string | null
      }>
    | null
}

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0)
}

function toMetricSummary(
  count: number | string | null | undefined,
  amount: number | string | null | undefined
): ClaimMetricSummary {
  return {
    count: toNumber(count),
    amount: toNumber(amount),
  }
}

function mapDashboardClaimStats(
  metrics: EmployeeClaimMetricsRow | null
): DashboardClaimStats {
  return {
    total: toMetricSummary(metrics?.total_count, metrics?.total_amount),
    pending: toMetricSummary(metrics?.pending_count, metrics?.pending_amount),
    approved: toMetricSummary(
      metrics?.approved_count,
      metrics?.approved_amount
    ),
    rejected: toMetricSummary(
      metrics?.rejected_count,
      metrics?.rejected_amount
    ),
    rejectedAllowReclaim: toMetricSummary(
      metrics?.rejected_allow_reclaim_count,
      metrics?.rejected_allow_reclaim_amount
    ),
  }
}

export async function getDashboardClaimStats(
  supabase: SupabaseClient,
  employeeId: string
): Promise<DashboardClaimStats> {
  const metrics = await getEmployeeClaimMetrics(supabase, employeeId)
  return mapDashboardClaimStats(metrics)
}

export async function getProfileClaimStats(
  supabase: SupabaseClient,
  employeeId: string
): Promise<ProfileClaimStats> {
  const metrics = await getEmployeeClaimMetrics(supabase, employeeId)

  const { data: financeApprovedStatuses, error: financeApprovedStatusError } =
    await supabase
      .from('claim_statuses')
      .select('id')
      .eq('status_code', 'APPROVED')
      .eq('is_active', true)

  if (financeApprovedStatusError) {
    throw new Error(financeApprovedStatusError.message)
  }

  let financeApproved = 0

  const financeApprovedStatusIds = (financeApprovedStatuses ?? []).map(
    (status) => status.id as string
  )

  if (financeApprovedStatusIds.length > 0) {
    const { count, error } = await supabase
      .from('expense_claims')
      .select('id', { count: 'exact', head: true })
      .eq('employee_id', employeeId)
      .in('status_id', financeApprovedStatusIds)

    if (error) {
      throw new Error(error.message)
    }

    financeApproved = count ?? 0
  }

  return {
    total: toNumber(metrics?.total_count),
    pending: toNumber(metrics?.pending_count),
    financeApproved,
    rejected: toNumber(metrics?.rejected_count),
    paymentReleased: toNumber(metrics?.approved_count),
  }
}

export async function getRecentClaimsForEmployee(
  supabase: SupabaseClient,
  employeeId: string
): Promise<DashboardRecentClaim[]> {
  const { data, error } = await supabase
    .from('expense_claims')
    .select(
      'id, claim_number, claim_date, total_amount, allow_resubmit, claim_statuses!status_id(status_code, status_name, display_color, allow_resubmit_status_name, allow_resubmit_display_color)'
    )
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as RecentClaimRow[]).map((row) => {
    const statusInfo = Array.isArray(row.claim_statuses)
      ? row.claim_statuses[0]
      : row.claim_statuses
    const display = getClaimStatusDisplay({
      statusCode: statusInfo?.status_code,
      statusName: statusInfo?.status_name,
      statusDisplayColor: statusInfo?.display_color,
      allowResubmit: Boolean(row.allow_resubmit),
      allowResubmitStatusName: statusInfo?.allow_resubmit_status_name,
      allowResubmitDisplayColor: statusInfo?.allow_resubmit_display_color,
    })

    return {
      id: row.id,
      claim_number: row.claim_number,
      claim_date: row.claim_date,
      total_amount: toNumber(row.total_amount),
      statusName: display.label,
      displayColor: display.colorToken,
    }
  })
}
