'use server'

import { revalidatePath } from 'next/cache'

import { getAdminContext } from '@/features/admin/actions/context'

type UpsertApproverRulePayload = {
  approvalLevel: number
  designationId: string
  requiresSameState: boolean
  isActive: boolean
}

export async function upsertApproverRuleAction(
  payload: UpsertApproverRulePayload
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const { supabase } = await getAdminContext()

    const { error } = await supabase.rpc(
      'admin_upsert_approver_selection_rule_atomic',
      {
        p_approval_level: payload.approvalLevel,
        p_designation_id: payload.designationId,
        p_requires_same_state: payload.requiresSameState,
        p_is_active: payload.isActive,
      }
    )

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath('/admin/approver-rules')

    return { ok: true, error: null }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unable to save approver rule.',
    }
  }
}
