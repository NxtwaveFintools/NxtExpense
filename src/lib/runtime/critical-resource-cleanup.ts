import { registerGracefulShutdownHandler } from '@/lib/utils/graceful-shutdown'
import {
  startShutdownRequestDrain,
  waitForTrackedRequestsToDrain,
} from '@/lib/runtime/shutdown-request-drain'

type CleanupLogger = Pick<Console, 'info' | 'warn' | 'error'>

type ResourceCleanupHandler = () => Promise<void> | void

type ResourceGroup = 'database' | 'cache' | 'background-jobs'

const RESOURCE_LOG_PREFIX = '[graceful-shutdown][resources]'
const DEFAULT_REQUEST_DRAIN_TIMEOUT_MS = 15_000

const databaseCleanupHandlers = new Map<string, ResourceCleanupHandler>()
const cacheCleanupHandlers = new Map<string, ResourceCleanupHandler>()
const backgroundJobCleanupHandlers = new Map<string, ResourceCleanupHandler>()

let cleanupHandlersRegistered = false
let unregisterCleanupHandlers: Array<() => void> = []

function normalizeName(name: string, resourceGroup: ResourceGroup): string {
  const normalized = name.trim()

  if (!normalized) {
    throw new Error(
      `Cleanup handler name cannot be empty for ${resourceGroup}.`
    )
  }

  return normalized
}

function registerResourceCleanup(
  resourceGroup: ResourceGroup,
  registry: Map<string, ResourceCleanupHandler>,
  name: string,
  cleanup: ResourceCleanupHandler
): () => void {
  const normalizedName = normalizeName(name, resourceGroup)

  if (registry.has(normalizedName)) {
    throw new Error(
      `Cleanup handler "${normalizedName}" is already registered for ${resourceGroup}.`
    )
  }

  registry.set(normalizedName, cleanup)

  return () => {
    registry.delete(normalizedName)
  }
}

async function runResourceGroupCleanup(
  resourceGroup: ResourceGroup,
  registry: Map<string, ResourceCleanupHandler>,
  logger: CleanupLogger
): Promise<void> {
  if (registry.size === 0) {
    logger.warn(
      `${RESOURCE_LOG_PREFIX} No ${resourceGroup} cleanup handlers registered.`
    )
    return
  }

  const entries = Array.from(registry.entries())

  for (const [name, cleanup] of entries) {
    logger.info(
      `${RESOURCE_LOG_PREFIX} ${resourceGroup} cleanup started: ${name}.`
    )

    try {
      await Promise.resolve(cleanup())
      logger.info(
        `${RESOURCE_LOG_PREFIX} ${resourceGroup} cleanup completed: ${name}.`
      )
    } catch (error) {
      logger.error(
        `${RESOURCE_LOG_PREFIX} ${resourceGroup} cleanup failed: ${name}.`,
        error
      )
    }
  }
}

function getRequestDrainTimeoutMs(): number {
  const raw = process.env.SHUTDOWN_REQUEST_DRAIN_TIMEOUT_MS

  if (!raw) {
    return DEFAULT_REQUEST_DRAIN_TIMEOUT_MS
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_REQUEST_DRAIN_TIMEOUT_MS
  }

  return Math.trunc(parsed)
}

export function registerDatabaseShutdownCleanup(
  name: string,
  cleanup: ResourceCleanupHandler
): () => void {
  return registerResourceCleanup(
    'database',
    databaseCleanupHandlers,
    name,
    cleanup
  )
}

export function registerCacheShutdownCleanup(
  name: string,
  cleanup: ResourceCleanupHandler
): () => void {
  return registerResourceCleanup('cache', cacheCleanupHandlers, name, cleanup)
}

export function registerBackgroundJobShutdownCleanup(
  name: string,
  cleanup: ResourceCleanupHandler
): () => void {
  return registerResourceCleanup(
    'background-jobs',
    backgroundJobCleanupHandlers,
    name,
    cleanup
  )
}

export function initializeCriticalResourceShutdownHandlers(
  logger: CleanupLogger = console
): void {
  if (cleanupHandlersRegistered) {
    return
  }

  const requestDrainTimeoutMs = getRequestDrainTimeoutMs()

  unregisterCleanupHandlers = [
    registerGracefulShutdownHandler('critical-resource-database', async () => {
      await runResourceGroupCleanup('database', databaseCleanupHandlers, logger)
    }),
    registerGracefulShutdownHandler('critical-resource-cache', async () => {
      await runResourceGroupCleanup('cache', cacheCleanupHandlers, logger)
    }),
    registerGracefulShutdownHandler(
      'critical-resource-background-jobs',
      async () => {
        await runResourceGroupCleanup(
          'background-jobs',
          backgroundJobCleanupHandlers,
          logger
        )
      }
    ),
    registerGracefulShutdownHandler(
      'critical-resource-request-drain',
      async () => {
        startShutdownRequestDrain(logger)
        await waitForTrackedRequestsToDrain({
          timeoutMs: requestDrainTimeoutMs,
          logger,
        })
        logger.info(`${RESOURCE_LOG_PREFIX} Request-drain step completed.`)
      }
    ),
  ]

  cleanupHandlersRegistered = true
}

export function resetCriticalResourceShutdownForTests(): void {
  databaseCleanupHandlers.clear()
  cacheCleanupHandlers.clear()
  backgroundJobCleanupHandlers.clear()

  unregisterCleanupHandlers.forEach((unregister) => unregister())
  unregisterCleanupHandlers = []

  cleanupHandlersRegistered = false
}
