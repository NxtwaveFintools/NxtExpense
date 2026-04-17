import type { SupabaseClient } from '@supabase/supabase-js'

type AdminFinanceOverview = {
  totalClaims: {
    count: number
    amount: number
  }
  pendingFinanceQueue: {
    count: number
    amount: number
  }
  paymentIssued: {
    count: number
    amount: number
  }
  rejected: {
    count: number
    amount: number
  }
}

type FinanceOverviewRpcRow = {
  total_claims_count: number | string | null
  total_claims_amount: number | string | null
  pending_finance_count: number | string | null
  pending_finance_amount: number | string | null
  payment_issued_count: number | string | null
  payment_issued_amount: number | string | null
  rejected_count: number | string | null
  rejected_amount: number | string | null
}

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0)
}

export async function getAdminFinanceOverview(
  supabase: SupabaseClient
): Promise<AdminFinanceOverview> {
  const { data, error } = await supabase.rpc(
    'get_admin_finance_overview_metrics'
  )

  if (error) {
    throw new Error(error.message)
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | FinanceOverviewRpcRow
    | null
    | undefined

  return {
    totalClaims: {
      count: toNumber(row?.total_claims_count),
      amount: toNumber(row?.total_claims_amount),
    },
    pendingFinanceQueue: {
      count: toNumber(row?.pending_finance_count),
      amount: toNumber(row?.pending_finance_amount),
    },
    paymentIssued: {
      count: toNumber(row?.payment_issued_count),
      amount: toNumber(row?.payment_issued_amount),
    },
    rejected: {
      count: toNumber(row?.rejected_count),
      amount: toNumber(row?.rejected_amount),
    },
  }
}
