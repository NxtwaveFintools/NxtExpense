'use server'

import { revalidatePath } from 'next/cache'

import {
  adminCreateEmployeeSchema,
  normalizeOptionalUuid,
} from '@/features/admin/validations'
import type { AdminCreateEmployeeResult } from '@/features/admin/types'

import { getAdminContext } from '@/features/admin/actions/context'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function createEmployeeAction(
  payload: unknown
): Promise<AdminCreateEmployeeResult> {
  const parsed = adminCreateEmployeeSchema.safeParse(payload)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid employee input.',
    }
  }

  let provisionedAuthUserId: string | null = null
  let employeeRowCreated = false

  try {
    const { supabase } = await getAdminContext()
    const adminSupabase = parsed.data.loginPassword
      ? createSupabaseAdminClient()
      : null

    if (parsed.data.loginPassword && adminSupabase) {
      const { data: authData, error: authError } =
        await adminSupabase.auth.admin.createUser({
          email: parsed.data.employeeEmail,
          password: parsed.data.loginPassword,
          email_confirm: true,
        })

      if (authError) {
        throw new Error(
          `Unable to create login credentials: ${authError.message}`
        )
      }

      provisionedAuthUserId = authData?.user?.id ?? null
    }

    const { data, error } = await supabase.rpc('admin_create_employee_atomic', {
      p_employee_id: parsed.data.employeeId,
      p_employee_name: parsed.data.employeeName,
      p_employee_email: parsed.data.employeeEmail,
      p_designation_id: parsed.data.designationId,
      p_employee_status_id: parsed.data.employeeStatusId,
      p_role_id: parsed.data.roleId,
      p_state_id: parsed.data.stateId,
      p_approval_employee_id_level_1: normalizeOptionalUuid(
        parsed.data.approvalEmployeeIdLevel1
      ),
      p_approval_employee_id_level_2: normalizeOptionalUuid(
        parsed.data.approvalEmployeeIdLevel2
      ),
      p_approval_employee_id_level_3: normalizeOptionalUuid(
        parsed.data.approvalEmployeeIdLevel3
      ),
    })

    if (error) {
      throw new Error(error.message)
    }

    employeeRowCreated = true

    const created = Array.isArray(data) ? data[0] : null

    if (created && parsed.data.replacementEmployeeId) {
      const { error: finalizeError } = await supabase.rpc(
        'admin_finalize_employee_replacement_atomic',
        {
          p_old_employee_id: parsed.data.replacementEmployeeId,
          p_new_employee_id: created.id,
          p_reason: parsed.data.replacementReason ?? '',
          p_confirmation: parsed.data.replacementConfirmation ?? 'CONFIRM',
        }
      )

      if (finalizeError) {
        throw new Error(
          `Unable to finalize replacement: ${finalizeError.message}`
        )
      }
    }

    revalidatePath('/admin/employees')

    return {
      ok: true,
      error: null,
      employee: created
        ? {
            id: created.id,
            employee_id: created.employee_id,
            employee_name: created.employee_name,
            employee_email: created.employee_email,
          }
        : undefined,
    }
  } catch (error) {
    let message =
      error instanceof Error ? error.message : 'Unable to create employee.'

    if (
      parsed.data.loginPassword &&
      !employeeRowCreated &&
      provisionedAuthUserId
    ) {
      try {
        const adminSupabase = createSupabaseAdminClient()
        const { error: rollbackError } =
          await adminSupabase.auth.admin.deleteUser(provisionedAuthUserId)

        if (rollbackError) {
          message = `${message} Auth rollback failed: ${rollbackError.message}`
        }
      } catch {
        message = `${message} Auth rollback failed.`
      }
    }

    return {
      ok: false,
      error: message,
    }
  }
}
