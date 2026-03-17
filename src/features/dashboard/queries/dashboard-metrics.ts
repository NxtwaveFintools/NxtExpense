import { getClaimStatusDisplayLabel } from '@/lib/utils/claim-status'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type DashboardClaimStats = {
  total: number
  pending: number
  approved: number
  rejected: number
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

function isRejectedStatus(
  statusCode: string | null,
  statusName: string | null
): boolean {
  const normalizedCode = (statusCode ?? '').toUpperCase()
  const normalizedName = (statusName ?? '').toLowerCase()

  return (
    normalizedCode.includes('REJECTED') || normalizedName.includes('rejected')
  )
}

function isFinanceApprovedStatus(
  statusCode: string | null,
  statusName: string | null
): boolean {
  const normalizedCode = (statusCode ?? '').toUpperCase()
  const normalizedName = (statusName ?? '').toLowerCase()

  return (
    normalizedCode === 'APPROVED' ||
    normalizedCode.includes('ISSUED') ||
    normalizedName === 'approved' ||
    normalizedName === 'finance approved' ||
    normalizedName.includes('issued')
  )
}

export async function getEmployeeClaimStats(
  supabase: DashboardSupabaseClient,
  employeeId: string
): Promise<DashboardClaimStats> {
  const { data, error } = await supabase
    .from('expense_claims')
    .select('id, claim_statuses!status_id(status_code, status_name)')
    .eq('employee_id', employeeId)

  if (error) {
    throw new Error(error.message)
  }

  const rows = data ?? []

  let pending = 0
  let rejected = 0
  let approved = 0

  for (const row of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusInfo = Array.isArray((row as any).claim_statuses)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (row as any).claim_statuses[0]
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (row as any).claim_statuses

    const statusCode =
      (statusInfo?.status_code as string | null | undefined) ?? null
    const statusName =
      (statusInfo?.status_name as string | null | undefined) ?? null

    if (isRejectedStatus(statusCode, statusName)) {
      rejected++
      continue
    }

    if (isFinanceApprovedStatus(statusCode, statusName)) {
      approved++
      continue
    }

    pending++
  }

  return { total: rows.length, pending, approved, rejected }
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
