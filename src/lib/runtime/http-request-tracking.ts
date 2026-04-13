import { Server, type IncomingMessage, type ServerResponse } from 'node:http'

import {
  beginTrackedRequest,
  finishTrackedRequest,
} from '@/lib/runtime/shutdown-request-drain'

type RequestTrackingLogger = Pick<Console, 'info' | 'warn'>

const HTTP_LOG_PREFIX = '[graceful-shutdown][http]'
const RETRY_AFTER_SECONDS = 5

let httpRequestTrackingInstalled = false
let originalServerEmit: typeof Server.prototype.emit | null = null

function invokeOriginalEmit(
  server: Server,
  eventName: string | symbol,
  args: unknown[]
): boolean {
  if (!originalServerEmit) {
    return false
  }

  const emitArgs: [string | symbol, ...unknown[]] = [eventName, ...args]
  return Reflect.apply(
    originalServerEmit as (...forwardedArgs: unknown[]) => boolean,
    server,
    emitArgs
  )
}

function writeShutdownResponse(response: ServerResponse): void {
  if (response.headersSent || response.writableEnded) {
    return
  }

  response.statusCode = 503
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Connection', 'close')
  response.setHeader('Retry-After', String(RETRY_AFTER_SECONDS))
  response.end(
    JSON.stringify({
      error:
        'Service temporarily unavailable. Server is shutting down. Please retry shortly.',
    })
  )
}

function toRequestLabel(request: IncomingMessage): string {
  const method = request.method ?? 'UNKNOWN'
  const url = request.url ?? '/'

  return `${method} ${url}`
}

export function installHttpRequestTracking(
  logger: RequestTrackingLogger = console
): void {
  if (httpRequestTrackingInstalled) {
    return
  }

  originalServerEmit = Server.prototype.emit

  Server.prototype.emit = function patchedEmit(
    this: Server,
    eventName: string | symbol,
    ...args: unknown[]
  ): boolean {
    if (eventName !== 'request') {
      return invokeOriginalEmit(this, eventName, args)
    }

    const [request, response] = args as [IncomingMessage, ServerResponse]

    if (!beginTrackedRequest()) {
      logger.warn(
        `${HTTP_LOG_PREFIX} Rejecting new request while draining: ${toRequestLabel(request)}.`
      )
      writeShutdownResponse(response)
      return true
    }

    let didFinish = false

    const completeRequest = () => {
      if (didFinish) {
        return
      }

      didFinish = true
      finishTrackedRequest()
    }

    response.once('finish', completeRequest)
    response.once('close', completeRequest)

    return invokeOriginalEmit(this, eventName, args)
  }

  httpRequestTrackingInstalled = true
  logger.info(`${HTTP_LOG_PREFIX} HTTP request tracking installed.`)
}

export function resetHttpRequestTrackingForTests(): void {
  if (originalServerEmit) {
    Server.prototype.emit = originalServerEmit
  }

  originalServerEmit = null
  httpRequestTrackingInstalled = false
}
