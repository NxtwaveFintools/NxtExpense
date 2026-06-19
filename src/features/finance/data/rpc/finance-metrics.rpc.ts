import type { SupabaseClient } from '@supabase/supabase-js'

type ClaimBucketMetricsRow = {
  total_count: number | string | null
  total_amount: number | string | null
  pending_count: number | string | null
  pending_amount: number | string | null
  approved_count: number | string | null
  approved_amount: number | string | null
  rejected_count: number | string | null
  rejected_amount: number | string | null
}

type FinanceHistoryMetricsRow = {
  total_count: number | string | null
  total_amount: number | string | null
  approved_count: number | string | null
  approved_amount: number | string | null
  rejected_count: number | string | null
  rejected_amount: number | string | null
  rejected_without_reclaim_count?: number | string | null
  rejected_without_reclaim_amount?: number | string | null
  rejected_allow_reclaim_count?: number | string | null
  rejected_allow_reclaim_amount?: number | string | null
  other_count: number | string | null
  other_amount: number | string | null
}

// Phase 2 — resolver-backed analytics RPCs. These take filter parameters directly
// (no p_claim_ids array); the claim scope is resolved server-side inside the SQL.
export async function getFinanceHistoryMetricsFilteredRpc(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<FinanceHistoryMetricsRow | null> {
  const { data, error } = await supabase.rpc(
    'get_finance_history_metrics',
    args
  )

  if (error) {
    throw new Error(error.message)
  }

  return (
    Array.isArray(data) ? data[0] : data
  ) as FinanceHistoryMetricsRow | null
}

export async function getFinanceQueueMetricsFilteredRpc(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<ClaimBucketMetricsRow | null> {
  const { data, error } = await supabase.rpc('get_finance_queue_metrics', args)

  if (error) {
    throw new Error(error.message)
  }

  return (Array.isArray(data) ? data[0] : data) as ClaimBucketMetricsRow | null
}
