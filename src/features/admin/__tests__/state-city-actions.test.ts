import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAdminContext: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/features/admin/actions/context', () => ({
  getAdminContext: mocks.getAdminContext,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

import {
  bulkImportCitiesAction,
  createCityAction,
  createStateAction,
  toggleCityActiveAction,
  toggleStateActiveAction,
  updateCityAction,
  updateStateAction,
} from '@/features/admin/actions/state-city-actions'

const VALID_ID = '5db22d75-b209-4f30-b5c8-f4f27ebee9e8'

describe('state-city admin actions', () => {
  let rpcMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    rpcMock = vi.fn().mockResolvedValue({ data: null, error: null })
    mocks.getAdminContext.mockResolvedValue({
      supabase: {
        rpc: rpcMock,
      },
    })
  })

  it('creates state via atomic RPC and revalidates state-city views', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          id: VALID_ID,
          state_code: 'TS',
          state_name: 'Telangana',
          is_active: true,
        },
      ],
      error: null,
    })

    const result = await createStateAction({
      stateName: 'Telangana',
      confirmation: 'CONFIRM',
    })

    expect(result).toEqual({
      ok: true,
      error: null,
      state: {
        id: VALID_ID,
        state_code: 'TS',
        state_name: 'Telangana',
        is_active: true,
      },
    })
    expect(rpcMock).toHaveBeenCalledWith('admin_create_state_atomic', {
      p_state_name: 'Telangana',
      p_confirmation: 'CONFIRM',
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/state-city')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/claims/new')
  })

  it('rejects invalid city update payload before calling RPC', async () => {
    const result = await updateCityAction({
      id: 'invalid-id',
      cityName: '',
      confirmation: 'CONFIRM',
    } as never)

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(rpcMock).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('returns summary payload from bulk import RPC', async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        stateId: VALID_ID,
        stateName: 'Telangana',
        totalTokens: 4,
        insertedCount: 2,
        duplicateCount: 1,
        invalidCount: 1,
        insertedCities: ['Warangal', 'Karimnagar'],
        duplicateCities: ['Hyderabad'],
        invalidCities: ['1234'],
      },
      error: null,
    })

    const result = await bulkImportCitiesAction({
      stateId: VALID_ID,
      rawInput: 'Warangal, Hyderabad, Karimnagar, 1234',
      confirmation: 'CONFIRM',
    })

    expect(result.ok).toBe(true)
    expect(result.summary?.insertedCount).toBe(2)
    expect(result.summary?.duplicateCount).toBe(1)
    expect(result.summary?.invalidCount).toBe(1)
    expect(rpcMock).toHaveBeenCalledWith('admin_bulk_import_cities_atomic', {
      p_state_id: VALID_ID,
      p_raw_input: 'Warangal, Hyderabad, Karimnagar, 1234',
      p_confirmation: 'CONFIRM',
    })
  })

  it('surfaces RPC errors for state and city toggles', async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'State toggle blocked.' },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'City toggle blocked.' },
      })

    const stateResult = await toggleStateActiveAction({
      id: VALID_ID,
      isActive: false,
      confirmation: 'CONFIRM',
    })

    const cityResult = await toggleCityActiveAction({
      id: VALID_ID,
      isActive: false,
      confirmation: 'CONFIRM',
    })

    expect(stateResult).toEqual({ ok: false, error: 'State toggle blocked.' })
    expect(cityResult).toEqual({ ok: false, error: 'City toggle blocked.' })
  })

  it('maps update RPCs correctly for state/city rename flows', async () => {
    await updateStateAction({
      id: VALID_ID,
      stateName: 'Andhra Pradesh',
      confirmation: 'CONFIRM',
    })

    await createCityAction({
      stateId: VALID_ID,
      cityName: 'Kurnool',
      confirmation: 'CONFIRM',
    })

    expect(rpcMock).toHaveBeenNthCalledWith(1, 'admin_update_state_atomic', {
      p_id: VALID_ID,
      p_state_name: 'Andhra Pradesh',
      p_confirmation: 'CONFIRM',
    })
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'admin_create_city_atomic', {
      p_state_id: VALID_ID,
      p_city_name: 'Kurnool',
      p_confirmation: 'CONFIRM',
    })
  })

  it('rejects createStateAction with empty state name', async () => {
    const result = await createStateAction({
      stateName: '',
      confirmation: 'CONFIRM',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('surfaces RPC errors for createStateAction', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'State already exists.' },
    })

    const result = await createStateAction({
      stateName: 'Telangana',
      confirmation: 'CONFIRM',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('State already exists.')
  })

  it('rejects updateStateAction with invalid UUID', async () => {
    const result = await updateStateAction({
      id: 'not-a-uuid',
      stateName: 'New Name',
      confirmation: 'CONFIRM',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('surfaces RPC errors for updateStateAction', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'State not found.' },
    })

    const result = await updateStateAction({
      id: VALID_ID,
      stateName: 'Renamed',
      confirmation: 'CONFIRM',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('State not found.')
  })

  it('returns ok and revalidates for toggleStateActiveAction success', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    const result = await toggleStateActiveAction({
      id: VALID_ID,
      isActive: true,
      confirmation: 'CONFIRM',
    })

    expect(result).toEqual({ ok: true, error: null })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/state-city')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/claims/new')
  })

  it('rejects toggleStateActiveAction with invalid UUID', async () => {
    const result = await toggleStateActiveAction({
      id: 'bad-id',
      isActive: false,
      confirmation: 'CONFIRM',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('rejects createCityAction with invalid stateId', async () => {
    const result = await createCityAction({
      stateId: 'not-a-uuid',
      cityName: 'Hyderabad',
      confirmation: 'CONFIRM',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('surfaces RPC errors for createCityAction', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'City already exists for this state.' },
    })

    const result = await createCityAction({
      stateId: VALID_ID,
      cityName: 'Hyderabad',
      confirmation: 'CONFIRM',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('City already exists for this state.')
  })

  it('surfaces RPC errors for updateCityAction', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'City not found.' },
    })

    const result = await updateCityAction({
      id: VALID_ID,
      cityName: 'Renamed City',
      confirmation: 'CONFIRM',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('City not found.')
  })

  it('returns ok and revalidates for toggleCityActiveAction success', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    const result = await toggleCityActiveAction({
      id: VALID_ID,
      isActive: false,
      confirmation: 'CONFIRM',
    })

    expect(result).toEqual({ ok: true, error: null })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/state-city')
  })

  it('rejects toggleCityActiveAction with invalid UUID', async () => {
    const result = await toggleCityActiveAction({
      id: 'bad-id',
      isActive: true,
      confirmation: 'CONFIRM',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('rejects bulkImportCitiesAction with empty input', async () => {
    const result = await bulkImportCitiesAction({
      stateId: VALID_ID,
      rawInput: '',
      confirmation: 'CONFIRM',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('surfaces RPC errors for bulkImportCitiesAction', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'Cannot import cities into an inactive state.' },
    })

    const result = await bulkImportCitiesAction({
      stateId: VALID_ID,
      rawInput: 'Warangal, Karimnagar',
      confirmation: 'CONFIRM',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Cannot import cities into an inactive state.')
  })
})
