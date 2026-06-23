import type { SupabaseClient } from '@supabase/supabase-js'

type MyClaimsMetricSummary = {
  count: number
  amount: number
}

export type MyClaimsStats = {
  total: MyClaimsMetricSummary
  pending: MyClaimsMetricSummary
  rejected: MyClaimsMetricSummary
  rejectedAllowReclaim: MyClaimsMetricSummary
}

export type EmployeeClaimMetricsRow = {
  total_count: number | string | null
  total_amount: number | string | null
  pending_count: number | string | null
  pending_amount: number | string | null
  approved_count: number | string | null
  approved_amount: number | string | null
  rejected_count: number | string | null
  rejected_amount: number | string | null
  rejected_allow_reclaim_count: number | string | null
  rejected_allow_reclaim_amount: number | string | null
}

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0)
}

export async function getEmployeeClaimMetrics(
  supabase: SupabaseClient,
  employeeId: string
): Promise<EmployeeClaimMetricsRow | null> {
  const { data, error } = await supabase.rpc('get_employee_claim_metrics', {
    p_employee_id: employeeId,
  })

  if (error) {
    throw new Error(error.message)
  }

  return (
    Array.isArray(data) ? data[0] : data
  ) as EmployeeClaimMetricsRow | null
}

export async function getMyClaimsStats(
  supabase: SupabaseClient,
  employeeId: string
): Promise<MyClaimsStats> {
  const metrics = await getEmployeeClaimMetrics(supabase, employeeId)

  return {
    total: {
      count: toNumber(metrics?.total_count),
      amount: toNumber(metrics?.total_amount),
    },
    pending: {
      count: toNumber(metrics?.pending_count),
      amount: toNumber(metrics?.pending_amount),
    },
    rejected: {
      count: toNumber(metrics?.rejected_count),
      amount: toNumber(metrics?.rejected_amount),
    },
    rejectedAllowReclaim: {
      count: toNumber(metrics?.rejected_allow_reclaim_count),
      amount: toNumber(metrics?.rejected_allow_reclaim_amount),
    },
  }
}
