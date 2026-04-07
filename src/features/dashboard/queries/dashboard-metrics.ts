import { getClaimStatusDisplay } from '@/lib/utils/claim-status'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type ClaimMetricSummary = {
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

type DashboardSupabaseClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>

type EmployeeClaimMetricsRow = {
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

export async function getEmployeeClaimStats(
  supabase: DashboardSupabaseClient,
  employeeId: string
): Promise<DashboardClaimStats> {
  const { data, error } = await supabase.rpc('get_employee_claim_metrics', {
    p_employee_id: employeeId,
  })

  if (error) {
    throw new Error(error.message)
  }

  const metrics = (
    Array.isArray(data) ? data[0] : data
  ) as EmployeeClaimMetricsRow | null

  const toNumber = (value: number | string | null | undefined): number =>
    Number(value ?? 0)

  return {
    total: {
      count: toNumber(metrics?.total_count),
      amount: toNumber(metrics?.total_amount),
    },
    pending: {
      count: toNumber(metrics?.pending_count),
      amount: toNumber(metrics?.pending_amount),
    },
    approved: {
      count: toNumber(metrics?.approved_count),
      amount: toNumber(metrics?.approved_amount),
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

export async function getRecentClaims(
  supabase: DashboardSupabaseClient,
  employeeId: string
): Promise<DashboardRecentClaim[]> {
  const { data } = await supabase
    .from('expense_claims')
    .select(
      'id, claim_number, claim_date, total_amount, allow_resubmit, claim_statuses!status_id(status_code, status_name, display_color, allow_resubmit_status_name, allow_resubmit_display_color)'
    )
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(5)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => {
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
      total_amount: Number(row.total_amount ?? 0),
      statusName: display.label,
      displayColor: display.colorToken,
    }
  })
}
