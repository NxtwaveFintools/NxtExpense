import type { SupabaseClient } from '@supabase/supabase-js'

export async function recordApprovalAction(
  supabase: SupabaseClient,
  input: {
    claimId: string
    approverEmail: string
    approvalLevel: number
    action: 'approved' | 'rejected'
    notes?: string
    allowResubmit?: boolean
  }
) {
  const { error } = await supabase.rpc('submit_approval_action_atomic', {
    p_claim_id: input.claimId,
    p_action: input.action,
    p_notes: input.notes ?? null,
    p_allow_resubmit:
      input.action === 'rejected' ? Boolean(input.allowResubmit) : false,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function advanceClaimStatus(): Promise<void> {
  throw new Error(
    'advanceClaimStatus is not supported. Use transition graph RPC functions instead.'
  )
}

export async function rejectClaim(): Promise<void> {
  throw new Error(
    'rejectClaim is not supported. Use transition graph RPC functions instead.'
  )
}
