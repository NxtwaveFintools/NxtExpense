type ProcessLike = Pick<NodeJS.Process, 'once' | 'exit'>

type GracefulShutdownLogger = Pick<Console, 'info' | 'warn' | 'error'>

export type GracefulShutdownHandler = () => Promise<void> | void

export type GracefulShutdownOptions = {
  processRef?: ProcessLike
  timeoutMs?: number
  logger?: GracefulShutdownLogger
}

export type GracefulShutdownManager = {
  initialize: (options?: GracefulShutdownOptions) => void
  registerHandler: (
    name: string,
    handler: GracefulShutdownHandler
  ) => () => void
  isInitialized: () => boolean
}

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000
const SHUTDOWN_LOG_PREFIX = '[graceful-shutdown]'

function normalizeShutdownTimeoutMs(value: number | undefined): number {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return DEFAULT_SHUTDOWN_TIMEOUT_MS
  }

  const normalized = Math.trunc(value as number)
  return normalized > 0 ? normalized : DEFAULT_SHUTDOWN_TIMEOUT_MS
}

function normalizeHandlerName(value: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error('Shutdown handler name cannot be empty.')
  }

  return normalized
}

export function createGracefulShutdownManager(): GracefulShutdownManager {
  const handlers = new Map<string, GracefulShutdownHandler>()
  let initialized = false
  let shutdownPromise: Promise<void> | null = null

  async function runHandlers(logger: GracefulShutdownLogger): Promise<void> {
    const entries = Array.from(handlers.entries()).reverse()

    for (const [name, handler] of entries) {
      logger.info(`${SHUTDOWN_LOG_PREFIX} Cleanup start: ${name}.`)

      try {
        await Promise.resolve(handler())
        logger.info(`${SHUTDOWN_LOG_PREFIX} Cleanup complete: ${name}.`)
      } catch (error) {
        logger.error(`${SHUTDOWN_LOG_PREFIX} Cleanup failed: ${name}.`, error)
      }
    }

    logger.info(`${SHUTDOWN_LOG_PREFIX} All cleanup handlers processed.`)
  }

  async function runHandlersWithTimeout(
    logger: GracefulShutdownLogger,
    timeoutMs: number
  ): Promise<void> {
    let timeoutHandle: NodeJS.Timeout | null = null

    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      timeoutHandle = setTimeout(() => resolve('timeout'), timeoutMs)
      timeoutHandle.unref?.()
    })

    const result = await Promise.race([
      runHandlers(logger).then(() => 'complete' as const),
      timeoutPromise,
    ])

    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }

    if (result === 'timeout') {
      logger.warn(
        `${SHUTDOWN_LOG_PREFIX} Cleanup timed out after ${timeoutMs}ms.`
      )
    }
  }

  function triggerShutdown(
    reason: string,
    exitCode: number,
    processRef: ProcessLike,
    logger: GracefulShutdownLogger,
    timeoutMs: number
  ) {
    if (shutdownPromise) {
      logger.warn(
        `${SHUTDOWN_LOG_PREFIX} Shutdown already in progress; ignoring ${reason}.`
      )
      return
    }

    shutdownPromise = (async () => {
      logger.info(
        `${SHUTDOWN_LOG_PREFIX} ${reason} received. Running ${handlers.size} cleanup handler(s).`
      )

      await runHandlersWithTimeout(logger, timeoutMs)

      logger.info(
        `${SHUTDOWN_LOG_PREFIX} Exiting process with code ${exitCode}.`
      )
      processRef.exit(exitCode)
    })().catch((error) => {
      logger.error(`${SHUTDOWN_LOG_PREFIX} Fatal shutdown error.`, error)
      processRef.exit(1)
    })
  }

  function initialize(options: GracefulShutdownOptions = {}): void {
    if (initialized) {
      return
    }

    const processRef = options.processRef ?? process
    const logger = options.logger ?? console
    const timeoutMs = normalizeShutdownTimeoutMs(options.timeoutMs)

    processRef.once('SIGTERM', () => {
      triggerShutdown('SIGTERM', 0, processRef, logger, timeoutMs)
    })

    processRef.once('SIGINT', () => {
      triggerShutdown('SIGINT', 130, processRef, logger, timeoutMs)
    })

    processRef.once('uncaughtException', (error) => {
      logger.error(`${SHUTDOWN_LOG_PREFIX} Uncaught exception detected.`, error)
      triggerShutdown('uncaughtException', 1, processRef, logger, timeoutMs)
    })

    processRef.once('unhandledRejection', (reason) => {
      logger.error(
        `${SHUTDOWN_LOG_PREFIX} Unhandled promise rejection detected.`,
        reason
      )
      triggerShutdown('unhandledRejection', 1, processRef, logger, timeoutMs)
    })

    initialized = true
    logger.info(`${SHUTDOWN_LOG_PREFIX} Lifecycle hooks registered.`)
  }

  function registerHandler(
    name: string,
    handler: GracefulShutdownHandler
  ): () => void {
    const normalizedName = normalizeHandlerName(name)

    if (shutdownPromise) {
      throw new Error(
        'Cannot register shutdown handler after shutdown has started.'
      )
    }

    if (handlers.has(normalizedName)) {
      throw new Error(
        `Shutdown handler "${normalizedName}" is already registered.`
      )
    }

    handlers.set(normalizedName, handler)

    return () => {
      handlers.delete(normalizedName)
    }
  }

  return {
    initialize,
    registerHandler,
    isInitialized: () => initialized,
  }
}

const gracefulShutdownManager = createGracefulShutdownManager()

export function initializeGracefulShutdown(
  options?: GracefulShutdownOptions
): void {
  gracefulShutdownManager.initialize(options)
}

export function registerGracefulShutdownHandler(
  name: string,
  handler: GracefulShutdownHandler
): () => void {
  return gracefulShutdownManager.registerHandler(name, handler)
}
