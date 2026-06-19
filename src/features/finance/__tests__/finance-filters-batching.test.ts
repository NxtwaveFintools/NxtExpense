import { describe, expect, it } from 'vitest'

import { collectClaimIdsInBatches } from '@/features/finance/data/repositories/finance-filters.repository'

// Regression: filtering Approved History by payment_released_date over a wide
// window resolved to 638 candidate claim IDs. The old code inlined all of them
// into a single `.in('id', [...])`, producing a ~23 KB GET URL that the Supabase
// gateway rejected with a generic 400 "Bad Request" (thrown as `Error: Bad Request`).
// The fix chunks the candidate set so every request URL stays small.

function makeIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `claim-${i}`)
}

describe('collectClaimIdsInBatches', () => {
  it('never sends more than the safe batch size of ids in a single query', async () => {
    const candidateIds = makeIds(638) // the production set that 400'd
    const seenBatchSizes: number[] = []

    const result = await collectClaimIdsInBatches(
      async (batchIds) => {
        seenBatchSizes.push(batchIds.length)
        return { data: batchIds.map((id) => ({ id })), error: null }
      },
      candidateIds,
      10_000
    )

    expect(Math.max(...seenBatchSizes)).toBeLessThanOrEqual(150)
    // every candidate is covered exactly once across the chunks
    expect(seenBatchSizes.reduce((a, b) => a + b, 0)).toBe(638)
    expect(new Set(result).size).toBe(638)
  })

  it('returns the union of matching ids across batches', async () => {
    const candidateIds = makeIds(300)

    const result = await collectClaimIdsInBatches(
      async (batchIds) => ({
        // only even-indexed candidates "match" the other filters
        data: batchIds
          .filter((id) => Number(id.split('-')[1]) % 2 === 0)
          .map((id) => ({ id })),
        error: null,
      }),
      candidateIds,
      10_000
    )

    expect(result).toHaveLength(150)
    expect(result.every((id) => Number(id.split('-')[1]) % 2 === 0)).toBe(true)
  })

  it('propagates a query error from any batch', async () => {
    await expect(
      collectClaimIdsInBatches(
        async () => ({ data: null, error: { message: 'Bad Request' } }),
        makeIds(200),
        10_000
      )
    ).rejects.toThrow('Bad Request')
  })

  it('enforces the max claim id limit across all batches combined', async () => {
    await expect(
      collectClaimIdsInBatches(
        async (batchIds) => ({
          data: batchIds.map((id) => ({ id })),
          error: null,
        }),
        makeIds(638),
        100
      )
    ).rejects.toThrow(/Filter result too large/)
  })
})
