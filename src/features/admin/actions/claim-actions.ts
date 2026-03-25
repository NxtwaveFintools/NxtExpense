'use server'

import type {
  AdminReassignResult,
  AdminStatusChangeResult,
} from '@/features/admin/types'
import {
  adminStatusChangeSchema,
  adminReassignApproverSchema,
} from '@/features/admin/validations'
import {
  getAdminClaimStatusOptions,
  searchClaimsForAdmin,
  searchEmployeesForAdmin,
  type AdminClaimStatusOption,
  type AdminClaimRow,
  type AdminEmployeeRow,
} from '@/features/admin/queries'
import {
  getMaxNotesLength,
  getMaxTextLengthValidationError,
} from '@/lib/services/system-settings-service'

import { getAdminContext } from '@/features/admin/actions/context'

export async function changeClaimStatusAction(payload: {
  claimId: string
  targetStatusId: string
  reason: string
  confirmation: 'CONFIRM'
}): Promise<AdminStatusChangeResult> {
  const parsed = adminStatusChangeSchema.safeParse(payload)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid status change input.',
    }
  }

  try {
    const { supabase } = await getAdminContext()
    const maxNotesLength = await getMaxNotesLength(supabase)
    const reasonValidationError = getMaxTextLengthValidationError(
      parsed.data.reason,
      maxNotesLength,
      'Status change reason'
    )

    if (reasonValidationError) {
      return {
        ok: false,
        error: reasonValidationError,
      }
    }

    const { data, error } = await supabase.rpc(
      'admin_change_claim_status_with_audit_atomic',
      {
        p_claim_id: parsed.data.claimId,
        p_target_status_id: parsed.data.targetStatusId,
        p_reason: parsed.data.reason,
        p_confirmation: parsed.data.confirmation,
      }
    )

    if (error) {
      throw new Error(error.message)
    }

    const row = Array.isArray(data) ? data[0] : null

    return {
      ok: true,
      error: null,
      claimId: row?.claim_id,
      previousStatusCode: row?.previous_status_code,
      updatedStatusCode: row?.updated_status_code,
    }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unable to change claim status.',
    }
  }
}

export async function getClaimStatusOptionsAction(): Promise<{
  ok: boolean
  error: string | null
  data: AdminClaimStatusOption[]
}> {
  try {
    const { supabase } = await getAdminContext()
    const data = await getAdminClaimStatusOptions(supabase)
    return { ok: true, error: null, data }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unable to load claim status options.',
      data: [],
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
    const maxNotesLength = await getMaxNotesLength(supabase)
    const reasonValidationError = getMaxTextLengthValidationError(
      parsed.data.reason,
      maxNotesLength,
      'Reassignment reason'
    )

    if (reasonValidationError) {
      return {
        ok: false,
        error: reasonValidationError,
      }
    }

    const { data, error } = await supabase.rpc(
      'admin_reassign_employee_approvers_with_audit_atomic',
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

export async function searchClaimsAction(
  query: string
): Promise<{ ok: boolean; error: string | null; data: AdminClaimRow[] }> {
  try {
    const { supabase } = await getAdminContext()
    const data = await searchClaimsForAdmin(supabase, query)
    return { ok: true, error: null, data }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Search failed.',
      data: [],
    }
  }
}

export async function searchEmployeesAction(
  query: string
): Promise<{ ok: boolean; error: string | null; data: AdminEmployeeRow[] }> {
  try {
    const { supabase } = await getAdminContext()
    const data = await searchEmployeesForAdmin(supabase, query)
    return { ok: true, error: null, data }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Search failed.',
      data: [],
    }
  }
}
