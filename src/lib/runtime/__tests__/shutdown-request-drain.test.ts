import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  beginTrackedRequest,
  finishTrackedRequest,
  getActiveTrackedRequestCount,
  resetShutdownRequestDrainForTests,
  startShutdownRequestDrain,
  waitForTrackedRequestsToDrain,
} from '@/lib/runtime/shutdown-request-drain'

describe('shutdown request drain', () => {
  beforeEach(() => {
    resetShutdownRequestDrainForTests()
  })

  it('tracks active request counts while accepting traffic', () => {
    expect(beginTrackedRequest()).toBe(true)
    expect(beginTrackedRequest()).toBe(true)
    expect(getActiveTrackedRequestCount()).toBe(2)

    finishTrackedRequest()
    expect(getActiveTrackedRequestCount()).toBe(1)

    finishTrackedRequest()
    expect(getActiveTrackedRequestCount()).toBe(0)
  })

  it('blocks new requests after shutdown drain begins', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    }

    startShutdownRequestDrain(logger)
    await waitForTrackedRequestsToDrain({
      logger,
      timeoutMs: 25,
      pollIntervalMs: 5,
    })

    expect(beginTrackedRequest()).toBe(false)
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Shutdown started. Blocking new requests')
    )
  })

  it('waits for active requests to finish before completing drain', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    }

    expect(beginTrackedRequest()).toBe(true)
    startShutdownRequestDrain(logger)

    setTimeout(() => {
      finishTrackedRequest()
    }, 15)

    await waitForTrackedRequestsToDrain({
      logger,
      timeoutMs: 200,
      pollIntervalMs: 5,
    })

    expect(getActiveTrackedRequestCount()).toBe(0)
    expect(logger.warn).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('All in-flight requests drained')
    )
  })

  it('logs timeout when requests do not drain in time', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    }

    expect(beginTrackedRequest()).toBe(true)
    startShutdownRequestDrain(logger)

    await waitForTrackedRequestsToDrain({
      logger,
      timeoutMs: 10,
      pollIntervalMs: 2,
    })

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Drain timeout reached')
    )
  })
})
