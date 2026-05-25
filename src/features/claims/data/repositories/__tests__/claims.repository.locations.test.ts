import { describe, expect, it, vi } from 'vitest'

import { validateCitiesForSelectedState } from '@/features/claims/data/repositories/claims.repository'

type QueryResponse = {
  data: unknown
  error: { message: string } | null
}

function createSupabaseMock(
  stateResponse: QueryResponse,
  cityResponse: QueryResponse
) {
  const stateMaybeSingle = vi.fn().mockResolvedValue(stateResponse)
  const stateEq = vi.fn().mockReturnValue({ maybeSingle: stateMaybeSingle })
  const stateSelect = vi.fn().mockReturnValue({ eq: stateEq })

  const cityIn = vi.fn().mockResolvedValue(cityResponse)
  const cityEqSecond = vi.fn().mockReturnValue({ in: cityIn })
  const cityEqFirst = vi.fn().mockReturnValue({ eq: cityEqSecond })
  const citySelect = vi.fn().mockReturnValue({ eq: cityEqFirst })

  const from = vi.fn((table: string) => {
    if (table === 'states') {
      return {
        select: stateSelect,
      }
    }

    return {
      select: citySelect,
    }
  })

  return {
    supabase: {
      from,
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

describe('validateCitiesForSelectedState', () => {
  const STATE_ID = '5db22d75-b209-4f30-b5c8-f4f27ebee9e8'

  it('returns error when state query fails', async () => {
    const { supabase } = createSupabaseMock(
      { data: null, error: { message: 'DB error' } },
      { data: [], error: null }
    )

    const result = await validateCitiesForSelectedState(supabase, STATE_ID, [
      'city-1',
    ])

    expect(result).toBe('Unable to validate selected state.')
  })

  it('rejects when state does not exist', async () => {
    const { supabase } = createSupabaseMock(
      { data: null, error: null },
      { data: [], error: null }
    )

    const result = await validateCitiesForSelectedState(supabase, STATE_ID, [
      'city-1',
    ])

    expect(result).toBe('Selected state is invalid.')
  })

  it('returns null when no city IDs are provided', async () => {
    const { supabase } = createSupabaseMock(
      { data: { id: STATE_ID, is_active: true }, error: null },
      { data: [], error: null }
    )

    const result = await validateCitiesForSelectedState(supabase, STATE_ID, [
      undefined,
      undefined,
    ])

    expect(result).toBeNull()
  })

  it('returns error when city query fails', async () => {
    const { supabase } = createSupabaseMock(
      { data: { id: STATE_ID, is_active: true }, error: null },
      { data: null, error: { message: 'DB error' } }
    )

    const result = await validateCitiesForSelectedState(supabase, STATE_ID, [
      'city-1',
    ])

    expect(result).toBe(
      'Unable to validate selected cities for the chosen state.'
    )
  })

  it('rejects inactive selected states', async () => {
    const { supabase } = createSupabaseMock(
      {
        data: { id: STATE_ID, is_active: false },
        error: null,
      },
      {
        data: [],
        error: null,
      }
    )

    const result = await validateCitiesForSelectedState(supabase, STATE_ID, [
      'city-1',
    ])

    expect(result).toBe(
      'Selected state is inactive. Please choose an active state.'
    )
  })

  it('rejects cities that are not active under the selected state', async () => {
    const { supabase } = createSupabaseMock(
      {
        data: { id: STATE_ID, is_active: true },
        error: null,
      },
      {
        data: [{ id: 'city-1' }],
        error: null,
      }
    )

    const result = await validateCitiesForSelectedState(supabase, STATE_ID, [
      'city-1',
      'city-2',
    ])

    expect(result).toBe(
      'Selected cities must be active and belong to the selected state.'
    )
  })

  it('accepts valid state and city combinations', async () => {
    const { supabase } = createSupabaseMock(
      {
        data: { id: STATE_ID, is_active: true },
        error: null,
      },
      {
        data: [{ id: 'city-1' }, { id: 'city-2' }],
        error: null,
      }
    )

    const result = await validateCitiesForSelectedState(supabase, STATE_ID, [
      'city-1',
      'city-2',
      'city-2',
    ])

    expect(result).toBeNull()
  })
})
