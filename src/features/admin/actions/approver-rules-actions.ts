'use server'

import { revalidatePath } from 'next/cache'

import { getAdminContext } from '@/features/admin/actions/context'
import { adminUpsertApproverRuleSchema } from '@/features/admin/validations'

type UpsertApproverRulePayload = {
  approvalLevel: number
  designationId: string
  requiresSameState: boolean
  isActive: boolean
  confirmation: 'CONFIRM'
}

export async function upsertApproverRuleAction(
  payload: UpsertApproverRulePayload
): Promise<{ ok: boolean; error: string | null }> {
  const parsed = adminUpsertApproverRuleSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }
  }

  try {
    const { supabase } = await getAdminContext()

    const { error } = await supabase.rpc(
      'admin_upsert_approver_selection_rule_atomic',
      {
        p_approval_level: parsed.data.approvalLevel,
        p_designation_id: parsed.data.designationId,
        p_requires_same_state: parsed.data.requiresSameState,
        p_is_active: parsed.data.isActive,
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
