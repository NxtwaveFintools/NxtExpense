import type { SupabaseClient } from '@supabase/supabase-js'

type PendingApprovalsMetricsRow = {
  claim_count: number | string | null
  total_amount: number | string | null
}

export async function getPendingApprovalsMetricsRpc(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<PendingApprovalsMetricsRow | null> {
  const { data, error } = await supabase.rpc(
    'get_pending_approvals_metrics',
    args
  )

  if (error) {
    throw new Error(error.message)
  }

  return (
    Array.isArray(data) ? data[0] : data
  ) as PendingApprovalsMetricsRow | null
}
