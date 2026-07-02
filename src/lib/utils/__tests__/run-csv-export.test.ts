import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateExportProgress: vi.fn(),
  markExportDone: vi.fn(),
  markExportError: vi.fn(),
}))

vi.mock('@/lib/utils/export-progress-registry', () => ({
  updateExportProgress: mocks.updateExportProgress,
  markExportDone: mocks.markExportDone,
  markExportError: mocks.markExportError,
}))

import {
  runCsvExport,
  exportTooLargeResponse,
  EXPORT_CHUNK_SIZE,
  MAX_EXPORT_ROWS,
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

    const response = runCsvExport<{ value: string }>(
      {
        fetchPage,
        headers: ['Value'],
        mapRow: (row) => [row.value],
        filename: 'stream.csv',
      },
      null
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="stream.csv"'
    )
    expect(response.headers.get('transfer-encoding')).toBe('chunked')

    await expect(response.text()).resolves.toBe('"Value"\n"A"\n"B"\n"C"\n')

    expect(fetchPage).toHaveBeenNthCalledWith(1, null, EXPORT_CHUNK_SIZE)
    expect(fetchPage).toHaveBeenNthCalledWith(2, 'cursor-2', EXPORT_CHUNK_SIZE)
  })

  it('emits only the header row when fetchPage returns no records', async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      data: [],
      hasNextPage: false,
      nextCursor: null,
    })

    const response = runCsvExport<{ value: string }>(
      {
        fetchPage,
        headers: ['Value'],
        mapRow: (row) => [row.value],
        filename: 'empty.csv',
      },
      null
    )

    await expect(response.text()).resolves.toBe('"Value"\n')
  })

  it('errors the stream when the row cap is exceeded', async () => {
    const mapRow = vi.fn((row: { value: string }) => [row.value])
    const fetchPage = vi.fn().mockResolvedValue({
      data: Array.from({ length: MAX_EXPORT_ROWS + 1 }, (_, i) => ({
        value: `row-${i}`,
      })),
      hasNextPage: false,
      nextCursor: null,
    })

    const response = runCsvExport<{ value: string }>(
      { fetchPage, headers: ['Value'], mapRow, filename: 'too-large.csv' },
      null
    )

    const reader = response.body?.getReader()
    if (!reader)
      throw new Error('Expected response stream body to be available.')

    const firstChunk = await reader.read()
    expect(firstChunk.done).toBe(false)

    await expect(reader.read()).rejects.toThrow(
      /Export exceeds 50000 rows\. Apply filters to narrow results\./
    )
    expect(mapRow).not.toHaveBeenCalled()
  })

  it('propagates fetchPage errors through the stream reader', async () => {
    const response = runCsvExport<{ value: string }>(
      {
        fetchPage: vi.fn().mockRejectedValue(new Error('boom')),
        headers: ['Value'],
        mapRow: (row: { value: string }) => [row.value],
        filename: 'error.csv',
      },
      null
    )

    const reader = response.body?.getReader()
    if (!reader)
      throw new Error('Expected response stream body to be available.')

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

  it('when requestId is null, never touches the progress registry', async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      data: [{ value: 'A' }],
      hasNextPage: false,
      nextCursor: null,
    })

    const response = runCsvExport<{ value: string }>(
      {
        fetchPage,
        headers: ['Value'],
        mapRow: (row) => [row.value],
        filename: 'x.csv',
      },
      null
    )
    await response.text()

    expect(mocks.updateExportProgress).not.toHaveBeenCalled()
    expect(mocks.markExportDone).not.toHaveBeenCalled()
    expect(mocks.markExportError).not.toHaveBeenCalled()
  })

  it('when requestId is provided, updates progress per chunk and marks done at stream end', async () => {
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

    const response = runCsvExport<{ value: string }>(
      {
        fetchPage,
        headers: ['Value'],
        mapRow: (row) => [row.value],
        filename: 'x.csv',
      },
      'request-123'
    )
    await response.text()

    expect(mocks.updateExportProgress).toHaveBeenNthCalledWith(
      1,
      'request-123',
      2
    )
    expect(mocks.updateExportProgress).toHaveBeenNthCalledWith(
      2,
      'request-123',
      3
    )
    expect(mocks.markExportDone).toHaveBeenCalledWith('request-123')
    expect(mocks.markExportError).not.toHaveBeenCalled()
  })

  it('when requestId is provided and fetchPage throws, marks the progress entry errored', async () => {
    const response = runCsvExport<{ value: string }>(
      {
        fetchPage: vi.fn().mockRejectedValue(new Error('boom')),
        headers: ['Value'],
        mapRow: (row: { value: string }) => [row.value],
        filename: 'x.csv',
      },
      'request-456'
    )

    const reader = response.body?.getReader()
    if (!reader)
      throw new Error('Expected response stream body to be available.')
    await reader.read()
    await expect(reader.read()).rejects.toThrow('boom')

    expect(mocks.markExportError).toHaveBeenCalledWith('request-456', 'boom')
    expect(mocks.markExportDone).not.toHaveBeenCalled()
  })
})
