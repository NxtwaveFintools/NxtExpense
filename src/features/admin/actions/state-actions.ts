'use server'

import { revalidatePath } from 'next/cache'

import {
  adminCreateStateSchema,
  adminToggleActiveSchema,
  adminUpdateStateSchema,
} from '@/features/admin/validations'
import { getAdminContext } from '@/features/admin/actions/context'
import type { AdminActionResult } from '@/features/admin/types'

type StateRow = {
  id: string
  state_code: string
  state_name: string
  is_active: boolean
}

type StateActionResult = AdminActionResult & {
  state?: StateRow
}

function revalidateStateCityViews() {
  revalidatePath('/admin/state-city')
  revalidatePath('/claims/new')
}

function readFirstRow<T>(data: unknown): T | null {
  if (!Array.isArray(data) || data.length === 0) {
    return null
  }

  return data[0] as T
}

export async function createStateAction(payload: {
  stateName: string
  confirmation: 'CONFIRM'
}): Promise<StateActionResult> {
  const parsed = adminCreateStateSchema.safeParse(payload)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }
  }

  try {
    const { supabase } = await getAdminContext()
    const { data, error } = await supabase.rpc('admin_create_state_atomic', {
      p_state_name: parsed.data.stateName,
      p_confirmation: parsed.data.confirmation,
    })

    if (error) {
      throw new Error(error.message)
    }

    revalidateStateCityViews()

    return {
      ok: true,
      error: null,
      state: readFirstRow<StateRow>(data) ?? undefined,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to create state.',
    }
  }
}

export async function updateStateAction(payload: {
  id: string
  stateName: string
  confirmation: 'CONFIRM'
}): Promise<StateActionResult> {
  const parsed = adminUpdateStateSchema.safeParse(payload)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }
  }

  try {
    const { supabase } = await getAdminContext()
    const { data, error } = await supabase.rpc('admin_update_state_atomic', {
      p_id: parsed.data.id,
      p_state_name: parsed.data.stateName,
      p_confirmation: parsed.data.confirmation,
    })

    if (error) {
      throw new Error(error.message)
    }

    revalidateStateCityViews()

    return {
      ok: true,
      error: null,
      state: readFirstRow<StateRow>(data) ?? undefined,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to update state.',
    }
  }
}

export async function toggleStateActiveAction(payload: {
  id: string
  isActive: boolean
  confirmation: 'CONFIRM'
}): Promise<AdminActionResult> {
  const parsed = adminToggleActiveSchema.safeParse(payload)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }
  }

  try {
    const { supabase } = await getAdminContext()
    const { error } = await supabase.rpc('admin_toggle_state_active_atomic', {
      p_id: parsed.data.id,
      p_is_active: parsed.data.isActive,
      p_confirmation: parsed.data.confirmation,
    })

    if (error) {
      throw new Error(error.message)
    }

    revalidateStateCityViews()

    return { ok: true, error: null }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unable to update state status.',
    }
  }
}
