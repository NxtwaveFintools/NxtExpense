import { beforeEach, describe, expect, it, vi } from 'vitest'

const { registerGracefulShutdownHandlerMock, registeredHandlers } = vi.hoisted(
  () => {
    const handlers = new Map<string, () => Promise<void> | void>()

    return {
      registerGracefulShutdownHandlerMock: vi.fn((name, handler) => {
        handlers.set(name, handler)
        return () => {
          handlers.delete(name)
        }
      }),
      registeredHandlers: handlers,
    }
  }
)

vi.mock('@/lib/utils/graceful-shutdown', () => ({
  registerGracefulShutdownHandler: registerGracefulShutdownHandlerMock,
}))

import {
  initializeCriticalResourceShutdownHandlers,
  registerBackgroundJobShutdownCleanup,
  registerCacheShutdownCleanup,
  registerDatabaseShutdownCleanup,
  resetCriticalResourceShutdownForTests,
} from '@/lib/runtime/critical-resource-cleanup'
import {
  beginTrackedRequest,
  resetShutdownRequestDrainForTests,
} from '@/lib/runtime/shutdown-request-drain'

describe('critical resource cleanup', () => {
  beforeEach(() => {
    resetCriticalResourceShutdownForTests()
    resetShutdownRequestDrainForTests()
    registerGracefulShutdownHandlerMock.mockClear()
    registeredHandlers.clear()
  })

  it('registers resource cleanup handlers only once', () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }

    initializeCriticalResourceShutdownHandlers(logger)
    initializeCriticalResourceShutdownHandlers(logger)

    expect(registerGracefulShutdownHandlerMock).toHaveBeenCalledTimes(4)
    expect(Array.from(registeredHandlers.keys())).toEqual([
      'critical-resource-database',
      'critical-resource-cache',
      'critical-resource-background-jobs',
      'critical-resource-request-drain',
    ])
  })

  it('runs database, cache, and background job cleanup handlers', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }

    const databaseCleanup = vi.fn(() => undefined)
    const cacheCleanup = vi.fn(() => undefined)
    const backgroundCleanup = vi.fn(() => undefined)

    registerDatabaseShutdownCleanup('supabase-database', databaseCleanup)
    registerCacheShutdownCleanup('runtime-cache', cacheCleanup)
    registerBackgroundJobShutdownCleanup(
      'claim-export-worker',
      backgroundCleanup
    )

    initializeCriticalResourceShutdownHandlers(logger)

    await Promise.resolve(
      registeredHandlers.get('critical-resource-database')?.()
    )
    await Promise.resolve(registeredHandlers.get('critical-resource-cache')?.())
    await Promise.resolve(
      registeredHandlers.get('critical-resource-background-jobs')?.()
    )

    expect(databaseCleanup).toHaveBeenCalledTimes(1)
    expect(cacheCleanup).toHaveBeenCalledTimes(1)
    expect(backgroundCleanup).toHaveBeenCalledTimes(1)
  })

  it('starts request drain and blocks new requests when drain handler runs', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }

    initializeCriticalResourceShutdownHandlers(logger)

    await Promise.resolve(
      registeredHandlers.get('critical-resource-request-drain')?.()
    )

    expect(beginTrackedRequest()).toBe(false)
  })

  it('logs per-resource cleanup failures without throwing', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }

    registerCacheShutdownCleanup('redis-cache', () => {
      throw new Error('cache shutdown failed')
    })

    initializeCriticalResourceShutdownHandlers(logger)

    await Promise.resolve(registeredHandlers.get('critical-resource-cache')?.())

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('cache cleanup failed: redis-cache.'),
      expect.any(Error)
    )
  })
})
