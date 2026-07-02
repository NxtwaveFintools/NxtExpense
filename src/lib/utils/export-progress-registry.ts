import { randomUUID } from 'node:crypto'

export type ExportProgressStatus = 'streaming' | 'done' | 'error'

export type ExportProgressEntry = {
  employeeId: string
  status: ExportProgressStatus
  rowsSent: number
  estimatedTotalRows: number | null
  errorMessage: string | null
  updatedAt: number
}

const EXPORT_PROGRESS_TTL_MS = 5 * 60 * 1000
const EXPORT_PROGRESS_SWEEP_INTERVAL_MS = 60 * 1000

const registry = new Map<string, ExportProgressEntry>()
let sweepIntervalHandle: ReturnType<typeof setInterval> | null = null

export function createExportProgress(
  employeeId: string,
  estimatedTotalRows: number | null
): string {
  const requestId = randomUUID()

  registry.set(requestId, {
    employeeId,
    status: 'streaming',
    rowsSent: 0,
    estimatedTotalRows,
    errorMessage: null,
    updatedAt: Date.now(),
  })

  return requestId
}

export function updateExportProgress(requestId: string, rowsSent: number): void {
  const entry = registry.get(requestId)

  if (!entry) {
    return
  }

  entry.rowsSent = rowsSent
  entry.updatedAt = Date.now()
}

export function markExportDone(requestId: string): void {
  const entry = registry.get(requestId)

  if (!entry) {
    return
  }

  entry.status = 'done'
  entry.updatedAt = Date.now()
}

export function markExportError(requestId: string, message: string): void {
  const entry = registry.get(requestId)

  if (!entry) {
    return
  }

  entry.status = 'error'
  entry.errorMessage = message
  entry.updatedAt = Date.now()
}

export function getExportProgress(
  requestId: string,
  employeeId: string
): ExportProgressEntry | null {
  const entry = registry.get(requestId)

  if (!entry || entry.employeeId !== employeeId) {
    return null
  }

  return entry
}

function sweepExpiredExportProgress(now: number): void {
  for (const [requestId, entry] of registry) {
    if (now - entry.updatedAt > EXPORT_PROGRESS_TTL_MS) {
      registry.delete(requestId)
    }
  }
}

export function startExportProgressSweep(): () => void {
  if (!sweepIntervalHandle) {
    sweepIntervalHandle = setInterval(() => {
      sweepExpiredExportProgress(Date.now())
    }, EXPORT_PROGRESS_SWEEP_INTERVAL_MS)

    sweepIntervalHandle.unref?.()
  }

  return stopExportProgressSweep
}

export function stopExportProgressSweep(): void {
  if (sweepIntervalHandle) {
    clearInterval(sweepIntervalHandle)
    sweepIntervalHandle = null
  }
}

export function resetExportProgressRegistryForTests(): void {
  registry.clear()
  stopExportProgressSweep()
}
