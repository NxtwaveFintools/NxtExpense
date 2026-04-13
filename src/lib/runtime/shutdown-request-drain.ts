type ShutdownRequestLogger = Pick<Console, 'info' | 'warn'>

type WaitForTrackedRequestsDrainOptions = {
  timeoutMs?: number
  pollIntervalMs?: number
  logger?: ShutdownRequestLogger
}

const REQUEST_LOG_PREFIX = '[graceful-shutdown][requests]'
const DEFAULT_DRAIN_TIMEOUT_MS = 15_000
const DEFAULT_DRAIN_POLL_INTERVAL_MS = 50

let shutdownInProgress = false
let activeRequestCount = 0

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return fallback
  }

  const normalized = Math.trunc(value as number)
  return normalized > 0 ? normalized : fallback
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => {
    const timeoutHandle = setTimeout(resolve, milliseconds)

    if (typeof timeoutHandle === 'object' && 'unref' in timeoutHandle) {
      timeoutHandle.unref?.()
    }
  })
}

export function beginTrackedRequest(): boolean {
  if (shutdownInProgress) {
    return false
  }

  activeRequestCount += 1
  return true
}

export function finishTrackedRequest(): void {
  activeRequestCount = Math.max(0, activeRequestCount - 1)
}

export function getActiveTrackedRequestCount(): number {
  return activeRequestCount
}

export function isShutdownRequestDrainInProgress(): boolean {
  return shutdownInProgress
}

export function startShutdownRequestDrain(
  logger: ShutdownRequestLogger = console
): void {
  if (shutdownInProgress) {
    return
  }

  shutdownInProgress = true
  logger.info(
    `${REQUEST_LOG_PREFIX} Shutdown started. Blocking new requests and draining ${activeRequestCount} in-flight request(s).`
  )
}

export async function waitForTrackedRequestsToDrain(
  options: WaitForTrackedRequestsDrainOptions = {}
): Promise<void> {
  const logger = options.logger ?? console
  const timeoutMs = normalizePositiveInteger(
    options.timeoutMs,
    DEFAULT_DRAIN_TIMEOUT_MS
  )
  const pollIntervalMs = normalizePositiveInteger(
    options.pollIntervalMs,
    DEFAULT_DRAIN_POLL_INTERVAL_MS
  )

  const startedAt = Date.now()

  while (activeRequestCount > 0) {
    const elapsed = Date.now() - startedAt

    if (elapsed >= timeoutMs) {
      logger.warn(
        `${REQUEST_LOG_PREFIX} Drain timeout reached after ${timeoutMs}ms with ${activeRequestCount} in-flight request(s) remaining.`
      )
      return
    }

    const remainingMs = timeoutMs - elapsed
    await delay(Math.min(pollIntervalMs, remainingMs))
  }

  logger.info(`${REQUEST_LOG_PREFIX} All in-flight requests drained.`)
}

export function resetShutdownRequestDrainForTests(): void {
  shutdownInProgress = false
  activeRequestCount = 0
}
