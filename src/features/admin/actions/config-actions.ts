'use server'

import {
  adminToggleActiveSchema,
  adminUpdateRateSchema,
  adminUpdateVehicleRatesSchema,
} from '@/features/admin/validations'

import { getAdminContext } from '@/features/admin/actions/context'

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
    const { error } = await supabase.rpc(
      'admin_toggle_designation_active_atomic',
      {
        p_id: parsed.data.id,
        p_is_active: parsed.data.isActive,
      }
    )
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
    const { error } = await supabase.rpc(
      'admin_toggle_work_location_active_atomic',
      {
        p_id: parsed.data.id,
        p_is_active: parsed.data.isActive,
      }
    )
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
    const { error } = await supabase.rpc(
      'admin_toggle_vehicle_type_active_atomic',
      {
        p_id: parsed.data.id,
        p_is_active: parsed.data.isActive,
      }
    )
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
    const { error } = await supabase.rpc('admin_update_vehicle_rates_atomic', {
      p_id: parsed.data.id,
      p_base_fuel_rate_per_day: parsed.data.baseFuelRatePerDay,
      p_intercity_rate_per_km: parsed.data.intercityRatePerKm,
      p_max_km_round_trip: parsed.data.maxKmRoundTrip,
    })
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
    const { error } = await supabase.rpc(
      'admin_update_expense_rate_amount_atomic',
      {
        p_id: parsed.data.id,
        p_rate_amount: parsed.data.rateAmount,
      }
    )
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
    const { error } = await supabase.rpc(
      'admin_toggle_expense_rate_active_atomic',
      {
        p_id: parsed.data.id,
        p_is_active: parsed.data.isActive,
      }
    )
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
