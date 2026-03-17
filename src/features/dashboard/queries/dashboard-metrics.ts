import { getClaimStatusDisplayLabel } from '@/lib/utils/claim-status'
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

type ClaimStatusRow = {
  id: string
  status_code: string
  is_rejection: boolean
  is_payment_issued: boolean
}

type EmployeeClaimSummaryRow = {
  id: string
  created_at: string
  status_id: string
  total_amount: number | string
}

function createMetricSummary(): ClaimMetricSummary {
  return { count: 0, amount: 0 }
}

function addToMetric(metric: ClaimMetricSummary, amount: number) {
  metric.count += 1
  metric.amount += amount
}

export async function getEmployeeClaimStats(
  supabase: DashboardSupabaseClient,
  employeeId: string
): Promise<DashboardClaimStats> {
  const { data: statusRows, error: statusError } = await supabase
    .from('claim_statuses')
    .select('id, status_code, is_rejection, is_payment_issued')
    .eq('is_active', true)

  if (statusError) {
    throw new Error(statusError.message)
  }

  const rejectedStatusIds = new Set(
    ((statusRows ?? []) as ClaimStatusRow[])
      .filter((status) => status.is_rejection)
      .map((status) => status.id)
  )

  const approvedStatusIds = new Set(
    ((statusRows ?? []) as ClaimStatusRow[])
      .filter(
        (status) =>
          status.is_payment_issued ||
          status.status_code.toUpperCase() === 'APPROVED'
      )
      .map((status) => status.id)
  )

  const stats: DashboardClaimStats = {
    total: createMetricSummary(),
    pending: createMetricSummary(),
    approved: createMetricSummary(),
    rejected: createMetricSummary(),
  }

  const pageSize = 500
  let lastCursor: { createdAt: string; id: string } | null = null

  for (;;) {
    let query = supabase
      .from('expense_claims')
      .select('id, created_at, status_id, total_amount')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize)

    if (lastCursor) {
      query = query.or(
        `created_at.lt.${lastCursor.createdAt},and(created_at.eq.${lastCursor.createdAt},id.lt.${lastCursor.id})`
      )
    }

    const { data: rows, error } = await query

    if (error) {
      throw new Error(error.message)
    }

    const claimRows = (rows ?? []) as EmployeeClaimSummaryRow[]
    if (claimRows.length === 0) {
      break
    }

    for (const row of claimRows) {
      const amount = Number(row.total_amount ?? 0)
      addToMetric(stats.total, amount)

      if (rejectedStatusIds.has(row.status_id)) {
        addToMetric(stats.rejected, amount)
        continue
      }

      if (approvedStatusIds.has(row.status_id)) {
        addToMetric(stats.approved, amount)
        continue
      }

      addToMetric(stats.pending, amount)
    }

    if (claimRows.length < pageSize) {
      break
    }

    const lastRow = claimRows[claimRows.length - 1]
    lastCursor = {
      createdAt: lastRow.created_at,
      id: lastRow.id,
    }
  }

  return stats
}

export async function getRecentClaims(
  supabase: DashboardSupabaseClient,
  employeeId: string
): Promise<DashboardRecentClaim[]> {
  const { data } = await supabase
    .from('expense_claims')
    .select(
      'id, claim_number, claim_date, total_amount, claim_statuses!status_id(status_code, status_name, display_color)'
    )
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(5)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => {
    const statusInfo = Array.isArray(row.claim_statuses)
      ? row.claim_statuses[0]
      : row.claim_statuses

    return {
      id: row.id,
      claim_number: row.claim_number,
      claim_date: row.claim_date,
      total_amount: Number(row.total_amount ?? 0),
      statusName: getClaimStatusDisplayLabel(
        statusInfo?.status_code,
        statusInfo?.status_name
      ),
      displayColor: statusInfo?.display_color ?? 'gray',
    }
  })
}
