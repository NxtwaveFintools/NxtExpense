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
  adminToggleActiveSchema,
  adminUpdateRateSchema,
  adminUpdateVehicleRatesSchema,
} from '@/features/admin/validations'
import { getEmployeeByEmail } from '@/lib/services/employee-service'
import {
  searchClaimsForAdmin,
  searchEmployeesForAdmin,
  type AdminClaimRow,
  type AdminEmployeeRow,
} from '@/features/admin/queries'

async function getAdminContext() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    throw new Error('Unauthorized request.')
  }

  const employee = await getEmployeeByEmail(supabase, user.email)
  if (!employee || !(await isAdminUser(supabase, employee))) {
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

// ────────────────────────────────────────────────────────────
// Search actions (for admin claim/employee lookups)
// ────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────
// CRUD actions for lookup tables
// ────────────────────────────────────────────────────────────

type ToggleResult = { ok: boolean; error: string | null }

export async function toggleDesignationActiveAction(payload: {
  id: string
  isActive: boolean
}): Promise<ToggleResult> {
  const parsed = adminToggleActiveSchema.safeParse(payload)
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }

  try {
    const { supabase } = await getAdminContext()
    const { error } = await supabase
      .from('designations')
      .update({ is_active: parsed.data.isActive })
      .eq('id', parsed.data.id)
    if (error) throw new Error(error.message)
    return { ok: true, error: null }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update designation.',
    }
  }
}

export async function toggleWorkLocationActiveAction(payload: {
  id: string
  isActive: boolean
}): Promise<ToggleResult> {
  const parsed = adminToggleActiveSchema.safeParse(payload)
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }

  try {
    const { supabase } = await getAdminContext()
    const { error } = await supabase
      .from('work_locations')
      .update({ is_active: parsed.data.isActive })
      .eq('id', parsed.data.id)
    if (error) throw new Error(error.message)
    return { ok: true, error: null }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update work location.',
    }
  }
}

export async function toggleVehicleTypeActiveAction(payload: {
  id: string
  isActive: boolean
}): Promise<ToggleResult> {
  const parsed = adminToggleActiveSchema.safeParse(payload)
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }

  try {
    const { supabase } = await getAdminContext()
    const { error } = await supabase
      .from('vehicle_types')
      .update({ is_active: parsed.data.isActive })
      .eq('id', parsed.data.id)
    if (error) throw new Error(error.message)
    return { ok: true, error: null }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update vehicle type.',
    }
  }
}

export async function updateVehicleRatesAction(payload: {
  id: string
  baseFuelRatePerDay: number
  intercityRatePerKm: number
  maxKmRoundTrip: number
}): Promise<ToggleResult> {
  const parsed = adminUpdateVehicleRatesSchema.safeParse(payload)
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }

  try {
    const { supabase } = await getAdminContext()
    const { error } = await supabase
      .from('vehicle_types')
      .update({
        base_fuel_rate_per_day: parsed.data.baseFuelRatePerDay,
        intercity_rate_per_km: parsed.data.intercityRatePerKm,
        max_km_round_trip: parsed.data.maxKmRoundTrip,
      })
      .eq('id', parsed.data.id)
    if (error) throw new Error(error.message)
    return { ok: true, error: null }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update vehicle rates.',
    }
  }
}

export async function updateExpenseRateAction(payload: {
  id: string
  rateAmount: number
}): Promise<ToggleResult> {
  const parsed = adminUpdateRateSchema.safeParse(payload)
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }

  try {
    const { supabase } = await getAdminContext()
    const { error } = await supabase
      .from('expense_rates')
      .update({ rate_amount: parsed.data.rateAmount })
      .eq('id', parsed.data.id)
    if (error) throw new Error(error.message)
    return { ok: true, error: null }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update expense rate.',
    }
  }
}

export async function toggleExpenseRateActiveAction(payload: {
  id: string
  isActive: boolean
}): Promise<ToggleResult> {
  const parsed = adminToggleActiveSchema.safeParse(payload)
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }

  try {
    const { supabase } = await getAdminContext()
    const { error } = await supabase
      .from('expense_rates')
      .update({ is_active: parsed.data.isActive })
      .eq('id', parsed.data.id)
    if (error) throw new Error(error.message)
    return { ok: true, error: null }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update expense rate.',
    }
  }
}
