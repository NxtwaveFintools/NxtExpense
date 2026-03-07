import type { SupabaseClient } from '@supabase/supabase-js'

import type { FinanceActionType } from '@/features/finance/types'

export async function recordFinanceAction(
  supabase: SupabaseClient,
  payload: {
    claimId: string
    action: FinanceActionType
    notes?: string
    allowResubmit?: boolean
  }
) {
  const { error } = await supabase.rpc('submit_finance_action_atomic', {
    p_claim_id: payload.claimId,
    p_action: payload.action,
    p_notes: payload.notes ?? null,
    p_allow_resubmit:
      payload.action === 'finance_rejected'
        ? Boolean(payload.allowResubmit)
        : false,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function bulkRecordFinanceActions(
  supabase: SupabaseClient,
  payload: {
    claimIds: string[]
    action: Extract<FinanceActionType, 'issued' | 'finance_rejected'>
    notes?: string
    allowResubmit?: boolean
  }
) {
  if (payload.claimIds.length === 0) {
    return
  }

  const { error } = await supabase.rpc('bulk_finance_actions_atomic', {
    p_claim_ids: payload.claimIds,
    p_action: payload.action,
    p_notes: payload.notes ?? null,
    p_allow_resubmit:
      payload.action === 'finance_rejected'
        ? Boolean(payload.allowResubmit)
        : false,
  })

  if (error) {
    throw new Error(error.message)
  }
}
