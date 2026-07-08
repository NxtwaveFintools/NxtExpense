import type { SupabaseClient } from '@supabase/supabase-js'

import type { MyClaimsFilters } from '@/features/claims/types'
import { resolveClaimAllowResubmitFilterValue } from '@/features/claims/data/queries/claim-status-filter.query'
import { parseClaimStatusFilterValue } from '@/lib/utils/claim-status-filter'

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

export type MyClaimsMetricsRow = {
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

async function getMyClaimsFilteredMetricsRpc(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<MyClaimsMetricsRow | null> {
  const { data, error } = await supabase.rpc('get_my_claims_metrics', args)

  if (error) {
    throw new Error(error.message)
  }

  return (Array.isArray(data) ? data[0] : data) as MyClaimsMetricsRow | null
}

// Filtered — powers the /claims page's KPI cards, which must respond to the
// active filter bar (Finding 3, 2026-07-01 audit). Distinct from
// getEmployeeClaimMetrics/getDashboardClaimStats/getProfileClaimStats below,
// which intentionally stay unfiltered for the dashboard/profile use case.
export async function getMyClaimsStats(
  supabase: SupabaseClient,
  employeeId: string,
  filters: MyClaimsFilters
): Promise<MyClaimsStats> {
  const parsedStatusFilter = parseClaimStatusFilterValue(filters.claimStatus)
  const allowResubmitFilter = await resolveClaimAllowResubmitFilterValue(
    supabase,
    parsedStatusFilter
  )

  const metrics = await getMyClaimsFilteredMetricsRpc(supabase, {
    p_employee_id: employeeId,
    p_status_id: parsedStatusFilter?.statusId ?? null,
    p_allow_resubmit: allowResubmitFilter,
    p_work_location_id: filters.workLocation,
    p_claim_date_from: filters.claimDateFrom,
    p_claim_date_to: filters.claimDateTo,
  })

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
