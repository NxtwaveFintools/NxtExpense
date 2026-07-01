import { describe, expect, it, vi } from 'vitest'

import {
  createStreamingCsvResponse,
  exportTooLargeResponse,
  EXPORT_CHUNK_SIZE,
  MAX_EXPORT_ROWS,
} from '@/lib/utils/streaming-export'

describe('streaming-export utilities', () => {
  it('streams CSV header and data rows across paginated fetches', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ value: 'A' }, { value: 'B' }],
        hasNextPage: true,
        nextCursor: 'cursor-2',
      })
      .mockResolvedValueOnce({
        data: [{ value: 'C' }],
        hasNextPage: false,
        nextCursor: null,
      })

    const response = createStreamingCsvResponse<{ value: string }>({
      fetcher,
      headers: ['Value'],
      mapRow: (row) => [row.value],
      filename: 'stream.csv',
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="stream.csv"'
    )
    expect(response.headers.get('transfer-encoding')).toBe('chunked')

    await expect(response.text()).resolves.toBe('"Value"\n"A"\n"B"\n"C"\n')

    expect(fetcher).toHaveBeenNthCalledWith(1, null, EXPORT_CHUNK_SIZE)
    expect(fetcher).toHaveBeenNthCalledWith(2, 'cursor-2', EXPORT_CHUNK_SIZE)
  })

  it('keeps the export chunk size under the db-max-rows ceiling, with room for the +1 probe row', () => {
    // Regression guard, post Phase-6 rewrite: get_finance_history_page now returns
    // fully-hydrated rows directly (no follow-up `.in('id', [...])` call), so the old
    // ~350-400 id URL-length ceiling no longer applies. The binding constraint is
    // `db-max-rows` (confirmed 1000 on dev and prod) — MINUS 1, because the RPC
    // internally requests `p_limit + 1` rows for its own hasNextPage probe. A chunk
    // size of exactly 1000 would make that request 1001 rows, which PostgREST would
    // silently truncate back to 1000, corrupting hasNextPage. 999 is the true ceiling.
    expect(EXPORT_CHUNK_SIZE).toBeLessThan(1000)
  })

  it('emits only header row when fetcher returns no records', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      data: [],
      hasNextPage: false,
      nextCursor: null,
    })

    const response = createStreamingCsvResponse<{ value: string }>({
      fetcher,
      headers: ['Value'],
      mapRow: (row: { value: string }) => [row.value],
      filename: 'empty.csv',
    })

    await expect(response.text()).resolves.toBe('"Value"\n')
  })

  it('errors stream when row cap is exceeded', async () => {
    const mapRow = vi.fn((row: { value: string }) => [row.value])
    const fetcher = vi.fn().mockResolvedValue({
      data: Array.from({ length: MAX_EXPORT_ROWS + 1 }, (_, i) => ({
        value: `row-${i}`,
      })),
      hasNextPage: false,
      nextCursor: null,
    })

    const response = createStreamingCsvResponse<{ value: string }>({
      fetcher,
      headers: ['Value'],
      mapRow,
      filename: 'too-large.csv',
    })

    const reader = response.body?.getReader()

    if (!reader) {
      throw new Error('Expected response stream body to be available.')
    }

    const firstChunk = await reader.read()
    expect(firstChunk.done).toBe(false)

    await expect(reader.read()).rejects.toThrow(
      /Export exceeds 50000 rows\. Apply filters to narrow results\./
    )
    expect(mapRow).not.toHaveBeenCalled()
  })

  it('propagates fetcher errors through stream reader', async () => {
    const response = createStreamingCsvResponse<{ value: string }>({
      fetcher: vi.fn().mockRejectedValue(new Error('boom')),
      headers: ['Value'],
      mapRow: (row: { value: string }) => [row.value],
      filename: 'error.csv',
    })

    const reader = response.body?.getReader()

    if (!reader) {
      throw new Error('Expected response stream body to be available.')
    }

    const firstChunk = await reader.read()
    expect(firstChunk.done).toBe(false)

    await expect(reader.read()).rejects.toThrow('boom')
  })

  it('returns 413 helper response for oversized export prechecks', async () => {
    const response = exportTooLargeResponse()

    expect(response.status).toBe(413)
    const body = await response.text()
    expect(body).toContain('Export too large.')
    expect(body).toContain('Maximum: 50000 rows.')
  })
})
