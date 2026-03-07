'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

import { isAdminUser } from '@/features/admin/permissions'
import type {
  AdminReassignResult,
  AdminRollbackResult,
} from '@/features/admin/types'
import {
  adminReassignApproverSchema,
  adminRollbackSchema,
} from '@/features/admin/validations'
import { getEmployeeByEmail } from '@/features/employees/queries'

async function getAdminContext() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    throw new Error('Unauthorized request.')
  }

  const employee = await getEmployeeByEmail(supabase, user.email)
  if (!employee || !isAdminUser(employee)) {
    throw new Error('Admin access is required.')
  }

  return { supabase, user, employee }
}

export async function rollbackClaimStatusAction(payload: {
  claimId: string
  reason: string
  confirmation: 'CONFIRM'
}): Promise<AdminRollbackResult> {
  const parsed = adminRollbackSchema.safeParse(payload)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid rollback input.',
    }
  }

  try {
    const { supabase } = await getAdminContext()
    const { data, error } = await supabase.rpc('admin_rollback_claim_atomic', {
      p_claim_id: parsed.data.claimId,
      p_reason: parsed.data.reason,
      p_confirmation: parsed.data.confirmation,
    })

    if (error) {
      throw new Error(error.message)
    }

    const row = Array.isArray(data) ? data[0] : null

    return {
      ok: true,
      error: null,
      claimId: row?.claim_id,
      rolledBackTo: row?.rolled_back_to,
    }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : 'Unable to rollback claim.',
    }
  }
}

export async function reassignApproversAction(payload: {
  employeeId: string
  approvalLevel1?: string
  approvalLevel2?: string
  approvalLevel3?: string
  reason: string
  confirmation: 'CONFIRM'
}): Promise<AdminReassignResult> {
  const parsed = adminReassignApproverSchema.safeParse(payload)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid reassignment input.',
    }
  }

  try {
    const { supabase } = await getAdminContext()
    const { data, error } = await supabase.rpc(
      'admin_reassign_employee_approvers_atomic',
      {
        p_employee_id: parsed.data.employeeId,
        p_level_1: parsed.data.approvalLevel1 ?? null,
        p_level_2: parsed.data.approvalLevel2 ?? null,
        p_level_3: parsed.data.approvalLevel3 ?? null,
        p_reason: parsed.data.reason,
        p_confirmation: parsed.data.confirmation,
      }
    )

    if (error) {
      throw new Error(error.message)
    }

    return {
      ok: true,
      error: null,
      impactedClaims: typeof data === 'number' ? data : 0,
    }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unable to reassign approvers.',
    }
  }
}
