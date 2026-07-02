import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createExportProgress,
  getExportProgress,
  markExportDone,
  markExportError,
  resetExportProgressRegistryForTests,
  startExportProgressSweep,
  stopExportProgressSweep,
  updateExportProgress,
} from '@/lib/utils/export-progress-registry'

describe('export-progress-registry', () => {
  beforeEach(() => {
    resetExportProgressRegistryForTests()
  })

  afterEach(() => {
    resetExportProgressRegistryForTests()
    vi.useRealTimers()
  })

  it('creates an entry with streaming status and the given estimated total', () => {
    const requestId = createExportProgress('emp-1', 250)
    const entry = getExportProgress(requestId, 'emp-1')

    expect(entry).toMatchObject({
      employeeId: 'emp-1',
      status: 'streaming',
      rowsSent: 0,
      estimatedTotalRows: 250,
      errorMessage: null,
    })
  })

  it('supports a null estimated total (indeterminate progress)', () => {
    const requestId = createExportProgress('emp-1', null)
    const entry = getExportProgress(requestId, 'emp-1')

    expect(entry?.estimatedTotalRows).toBeNull()
  })

  it('updates rowsSent as chunks stream', () => {
    const requestId = createExportProgress('emp-1', 100)

    updateExportProgress(requestId, 40)
    expect(getExportProgress(requestId, 'emp-1')?.rowsSent).toBe(40)

    updateExportProgress(requestId, 90)
    expect(getExportProgress(requestId, 'emp-1')?.rowsSent).toBe(90)
  })

  it('marks an entry done', () => {
    const requestId = createExportProgress('emp-1', 10)
    updateExportProgress(requestId, 10)
    markExportDone(requestId)

    expect(getExportProgress(requestId, 'emp-1')?.status).toBe('done')
  })

  it('marks an entry errored with a message', () => {
    const requestId = createExportProgress('emp-1', 10)
    markExportError(requestId, 'DB connection lost.')

    const entry = getExportProgress(requestId, 'emp-1')
    expect(entry?.status).toBe('error')
    expect(entry?.errorMessage).toBe('DB connection lost.')
  })

  it('returns null for an unknown requestId', () => {
    expect(getExportProgress('does-not-exist', 'emp-1')).toBeNull()
  })

  it('returns null when the requesting employee does not match the entry owner (scoping)', () => {
    const requestId = createExportProgress('emp-1', 10)
    expect(getExportProgress(requestId, 'emp-2')).toBeNull()
  })

  it('update/markDone/markError are no-ops for an unknown requestId (no throw)', () => {
    expect(() => updateExportProgress('does-not-exist', 5)).not.toThrow()
    expect(() => markExportDone('does-not-exist')).not.toThrow()
    expect(() => markExportError('does-not-exist', 'x')).not.toThrow()
  })

  it('sweep evicts entries older than the TTL and leaves fresh ones untouched', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-01T00:00:00.000Z'))

    const staleId = createExportProgress('emp-1', 10)

    vi.setSystemTime(new Date('2026-07-01T00:04:00.000Z'))
    const freshId = createExportProgress('emp-1', 10)

    // TTL is 5 minutes; advance to T+6min from the start so staleId (created at
    // T+0) is past TTL while freshId (created at T+4min) is not.
    vi.setSystemTime(new Date('2026-07-01T00:06:00.000Z'))
    startExportProgressSweep()
    vi.advanceTimersByTime(60_000)
    stopExportProgressSweep()

    expect(getExportProgress(staleId, 'emp-1')).toBeNull()
    expect(getExportProgress(freshId, 'emp-1')).not.toBeNull()
  })
})
