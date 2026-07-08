import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

const supabase = {
  rpc: mocks.rpc,
} as unknown as import('@supabase/supabase-js').SupabaseClient

import { getMappedClaimItemsByClaimId } from '@/features/finance/data/repositories/mapped-claim-items.repository'

function makeRow(claimId: string, itemType: string, amount: number) {
  return { claim_id: claimId, item_type: itemType, amount }
}

describe('getMappedClaimItemsByClaimId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an empty map without calling the RPC when claimIds is empty', async () => {
    const result = await getMappedClaimItemsByClaimId(supabase, [], ['food'])

    expect(result.size).toBe(0)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('returns an empty map without calling the RPC when mappedExpenseItemTypes is empty', async () => {
    const result = await getMappedClaimItemsByClaimId(supabase, ['c1'], [])

    expect(result.size).toBe(0)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('issues a single RPC call and merges rows when claimIds fits in one batch (180)', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [makeRow('c1', 'food', 100), makeRow('c1', 'fuel', 50)],
      error: null,
    })

    const result = await getMappedClaimItemsByClaimId(
      supabase,
      ['c1'],
      ['food', 'fuel']
    )

    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(result.get('c1')).toHaveLength(2)
  })

  it('splits a large claimIds input across multiple 180-claim RPC batches and preserves every returned row', async () => {
    const claimIds = Array.from({ length: 200 }, (_, i) => `claim-${i}`)

    mocks.rpc.mockImplementation(async (_fn: string, args) => {
      const batchIds = (args as { p_claim_ids: string[] }).p_claim_ids
      return {
        data: batchIds.map((id) => makeRow(id, 'food', 10)),
        error: null,
      }
    })

    const result = await getMappedClaimItemsByClaimId(supabase, claimIds, [
      'food',
    ])

    // 200 claim ids / 180-per-batch = 2 calls (180, 20)
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({
      p_claim_ids: expect.arrayContaining([]),
    })
    expect(
      (mocks.rpc.mock.calls[0][1] as { p_claim_ids: string[] }).p_claim_ids
    ).toHaveLength(180)
    expect(
      (mocks.rpc.mock.calls[1][1] as { p_claim_ids: string[] }).p_claim_ids
    ).toHaveLength(20)

    const totalIdsSent = mocks.rpc.mock.calls.reduce(
      (sum, call) =>
        sum + (call[1] as { p_claim_ids: string[] }).p_claim_ids.length,
      0
    )
    expect(totalIdsSent).toBe(200)

    expect(result.size).toBe(200)
    for (const claimId of claimIds) {
      expect(result.get(claimId)).toEqual([
        { claim_id: claimId, item_type: 'food', amount: 10 },
      ])
    }
  })

  it('sends the same expanded item-type list to every batch', async () => {
    const claimIds = Array.from({ length: 200 }, (_, i) => `claim-${i}`)
    mocks.rpc.mockResolvedValue({ data: [], error: null })

    await getMappedClaimItemsByClaimId(supabase, claimIds, ['fuel'])

    expect(mocks.rpc).toHaveBeenCalledTimes(2)
    for (const call of mocks.rpc.mock.calls) {
      // fuel expands to include intercity_travel per
      // expandMappedExpenseItemTypesForExport
      expect((call[1] as { p_item_types: string[] }).p_item_types).toEqual([
        'fuel',
        'intercity_travel',
      ])
    }
  })

  it('throws a descriptive error instead of silently truncating when a batch hits the row cap', async () => {
    const cappedRows = Array.from({ length: 1000 }, (_, i) =>
      makeRow('c1', 'food', i)
    )
    mocks.rpc.mockResolvedValueOnce({ data: cappedRows, error: null })

    await expect(
      getMappedClaimItemsByClaimId(supabase, ['c1'], ['food'])
    ).rejects.toThrow(/row cap/i)
  })

  it('propagates an RPC error', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'connection reset' },
    })

    await expect(
      getMappedClaimItemsByClaimId(supabase, ['c1'], ['food'])
    ).rejects.toThrow('connection reset')
  })
})
