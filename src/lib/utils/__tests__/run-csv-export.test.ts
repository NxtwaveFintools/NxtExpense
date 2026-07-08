import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  runCsvExport,
  EXPORT_CHUNK_SIZE,
  ENRICHMENT_EXPORT_CHUNK_SIZE,
} from '@/lib/utils/run-csv-export'

describe('runCsvExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('streams CSV header and data rows across paginated fetches', async () => {
    const fetchPage = vi
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

    const response = runCsvExport<{ value: string }>({
      fetchPage,
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

    expect(fetchPage).toHaveBeenNthCalledWith(1, null, EXPORT_CHUNK_SIZE)
    expect(fetchPage).toHaveBeenNthCalledWith(2, 'cursor-2', EXPORT_CHUNK_SIZE)
  })

  it('uses the recipe chunkSize override instead of EXPORT_CHUNK_SIZE when provided', async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      data: [{ value: 'A' }],
      hasNextPage: false,
      nextCursor: null,
    })

    const response = runCsvExport<{ value: string }>({
      fetchPage,
      headers: ['Value'],
      mapRow: (row) => [row.value],
      filename: 'x.csv',
      chunkSize: ENRICHMENT_EXPORT_CHUNK_SIZE,
    })
    await response.text()

    expect(fetchPage).toHaveBeenCalledWith(null, ENRICHMENT_EXPORT_CHUNK_SIZE)
  })

  it('emits only the header row when fetchPage returns no records', async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      data: [],
      hasNextPage: false,
      nextCursor: null,
    })

    const response = runCsvExport<{ value: string }>({
      fetchPage,
      headers: ['Value'],
      mapRow: (row) => [row.value],
      filename: 'empty.csv',
    })

    await expect(response.text()).resolves.toBe('"Value"\n')
  })

  it('propagates fetchPage errors through the stream reader', async () => {
    const response = runCsvExport<{ value: string }>({
      fetchPage: vi.fn().mockRejectedValue(new Error('boom')),
      headers: ['Value'],
      mapRow: (row: { value: string }) => [row.value],
      filename: 'error.csv',
    })

    const reader = response.body?.getReader()
    if (!reader)
      throw new Error('Expected response stream body to be available.')

    const firstChunk = await reader.read()
    expect(firstChunk.done).toBe(false)

    await expect(reader.read()).rejects.toThrow('boom')
  })
})
