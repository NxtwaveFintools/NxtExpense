'use server'

import { revalidatePath } from 'next/cache'

import {
  adminBulkImportCitiesSchema,
  adminCreateCitySchema,
  adminToggleActiveSchema,
  adminUpdateCitySchema,
} from '@/features/admin/validations'
import { getAdminContext } from '@/features/admin/actions/context'
import type { AdminActionResult } from '@/features/admin/types'

type CityRow = {
  id: string
  city_name: string
  state_id: string
  is_active: boolean
}

type BulkImportSummary = {
  stateId: string
  stateName: string
  totalTokens: number
  insertedCount: number
  duplicateCount: number
  invalidCount: number
  insertedCities: string[]
  duplicateCities: string[]
  invalidCities: string[]
}

type CityActionResult = AdminActionResult & {
  city?: CityRow
}

type BulkImportActionResult = AdminActionResult & {
  summary?: BulkImportSummary
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

export async function createCityAction(payload: {
  stateId: string
  cityName: string
  confirmation: 'CONFIRM'
}): Promise<CityActionResult> {
  const parsed = adminCreateCitySchema.safeParse(payload)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }
  }

  try {
    const { supabase } = await getAdminContext()
    const { data, error } = await supabase.rpc('admin_create_city_atomic', {
      p_state_id: parsed.data.stateId,
      p_city_name: parsed.data.cityName,
      p_confirmation: parsed.data.confirmation,
    })

    if (error) {
      throw new Error(error.message)
    }

    revalidateStateCityViews()

    return {
      ok: true,
      error: null,
      city: readFirstRow<CityRow>(data) ?? undefined,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to create city.',
    }
  }
}

export async function updateCityAction(payload: {
  id: string
  cityName: string
  confirmation: 'CONFIRM'
}): Promise<CityActionResult> {
  const parsed = adminUpdateCitySchema.safeParse(payload)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }
  }

  try {
    const { supabase } = await getAdminContext()
    const { data, error } = await supabase.rpc('admin_update_city_atomic', {
      p_id: parsed.data.id,
      p_city_name: parsed.data.cityName,
      p_confirmation: parsed.data.confirmation,
    })

    if (error) {
      throw new Error(error.message)
    }

    revalidateStateCityViews()

    return {
      ok: true,
      error: null,
      city: readFirstRow<CityRow>(data) ?? undefined,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to update city.',
    }
  }
}

export async function toggleCityActiveAction(payload: {
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
    const { error } = await supabase.rpc('admin_toggle_city_active_atomic', {
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
          : 'Unable to update city status.',
    }
  }
}

export async function bulkImportCitiesAction(payload: {
  stateId: string
  rawInput: string
  confirmation: 'CONFIRM'
}): Promise<BulkImportActionResult> {
  const parsed = adminBulkImportCitiesSchema.safeParse(payload)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }
  }

  try {
    const { supabase } = await getAdminContext()
    const { data, error } = await supabase.rpc(
      'admin_bulk_import_cities_atomic',
      {
        p_state_id: parsed.data.stateId,
        p_raw_input: parsed.data.rawInput,
        p_confirmation: parsed.data.confirmation,
      }
    )

    if (error) {
      throw new Error(error.message)
    }

    revalidateStateCityViews()

    return {
      ok: true,
      error: null,
      summary: (data ?? undefined) as BulkImportSummary | undefined,
    }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : 'Unable to import cities.',
    }
  }
}
