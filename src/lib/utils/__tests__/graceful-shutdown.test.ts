import { EventEmitter } from 'node:events'

import { describe, expect, it, vi } from 'vitest'

import { createGracefulShutdownManager } from '@/lib/utils/graceful-shutdown'

class MockProcess extends EventEmitter {
  public exit = vi.fn(() => undefined)

  once(eventName: string | symbol, listener: (...args: unknown[]) => void) {
    return super.once(eventName, listener)
  }

  emitSignal(signal: NodeJS.Signals) {
    this.emit(signal, signal)
  }

  emitUnhandledRejection(reason: unknown) {
    this.emit('unhandledRejection', reason, Promise.resolve())
  }
}

function createLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}

async function waitForProcessExit(mockProcess: MockProcess): Promise<void> {
  await vi.waitFor(() => {
    expect(mockProcess.exit).toHaveBeenCalledTimes(1)
  })
}

describe('graceful shutdown manager', () => {
  it('runs handlers in reverse registration order on SIGTERM', async () => {
    const manager = createGracefulShutdownManager()
    const mockProcess = new MockProcess()
    const logger = createLogger()
    const executionOrder: string[] = []

    manager.registerHandler('first-handler', () => {
      executionOrder.push('first-handler')
    })

    manager.registerHandler('second-handler', async () => {
      executionOrder.push('second-handler')
    })

    manager.initialize({
      processRef: mockProcess as unknown as NodeJS.Process,
      logger,
    })

    mockProcess.emitSignal('SIGTERM')
    await waitForProcessExit(mockProcess)

    expect(executionOrder).toEqual(['second-handler', 'first-handler'])
    expect(mockProcess.exit).toHaveBeenCalledWith(0)
  })

  it('ignores repeated shutdown triggers after first signal', async () => {
    const manager = createGracefulShutdownManager()
    const mockProcess = new MockProcess()
    const logger = createLogger()
    const cleanupHandler = vi.fn(() => undefined)

    manager.registerHandler('cleanup-handler', cleanupHandler)
    manager.initialize({
      processRef: mockProcess as unknown as NodeJS.Process,
      logger,
    })

    mockProcess.emitSignal('SIGINT')
    mockProcess.emitSignal('SIGTERM')
    await waitForProcessExit(mockProcess)

    expect(cleanupHandler).toHaveBeenCalledTimes(1)
    expect(mockProcess.exit).toHaveBeenCalledWith(130)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Shutdown already in progress')
    )
  })

  it('continues shutdown flow when one cleanup handler fails', async () => {
    const manager = createGracefulShutdownManager()
    const mockProcess = new MockProcess()
    const logger = createLogger()
    const successfulCleanup = vi.fn(() => undefined)

    manager.registerHandler('successful-cleanup', successfulCleanup)
    manager.registerHandler('failing-cleanup', () => {
      throw new Error('cleanup failed')
    })

    manager.initialize({
      processRef: mockProcess as unknown as NodeJS.Process,
      logger,
    })

    mockProcess.emitSignal('SIGTERM')
    await waitForProcessExit(mockProcess)

    expect(successfulCleanup).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Cleanup failed: failing-cleanup.'),
      expect.any(Error)
    )
    expect(mockProcess.exit).toHaveBeenCalledWith(0)
  })

  it('forces process exit when cleanup exceeds timeout', async () => {
    const manager = createGracefulShutdownManager()
    const mockProcess = new MockProcess()
    const logger = createLogger()

    manager.registerHandler(
      'never-resolving-cleanup',
      () => new Promise<void>(() => undefined)
    )

    manager.initialize({
      processRef: mockProcess as unknown as NodeJS.Process,
      logger,
      timeoutMs: 5,
    })

    mockProcess.emitSignal('SIGTERM')

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Cleanup timed out')
    )
    expect(mockProcess.exit).toHaveBeenCalledWith(0)
  })

  it('exits with failure code on unhandled rejection', async () => {
    const manager = createGracefulShutdownManager()
    const mockProcess = new MockProcess()
    const logger = createLogger()

    manager.initialize({
      processRef: mockProcess as unknown as NodeJS.Process,
      logger,
    })

    mockProcess.emitUnhandledRejection(new Error('async-failure'))
    await waitForProcessExit(mockProcess)

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Unhandled promise rejection detected.'),
      expect.any(Error)
    )
    expect(mockProcess.exit).toHaveBeenCalledWith(1)
  })

  it('rejects duplicate shutdown handler names', () => {
    const manager = createGracefulShutdownManager()

    manager.registerHandler('shared-handler-name', () => undefined)

    expect(() =>
      manager.registerHandler('shared-handler-name', () => undefined)
    ).toThrowError(
      'Shutdown handler "shared-handler-name" is already registered.'
    )
  })
})
