import { EventEmitter } from 'node:events'
import { Server } from 'node:http'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { beginTrackedRequestMock, finishTrackedRequestMock } = vi.hoisted(
  () => ({
    beginTrackedRequestMock: vi.fn(() => true),
    finishTrackedRequestMock: vi.fn(() => undefined),
  })
)

vi.mock('@/lib/runtime/shutdown-request-drain', () => ({
  beginTrackedRequest: beginTrackedRequestMock,
  finishTrackedRequest: finishTrackedRequestMock,
}))

import {
  installHttpRequestTracking,
  resetHttpRequestTrackingForTests,
} from '@/lib/runtime/http-request-tracking'

class MockResponse extends EventEmitter {
  public statusCode = 200
  public headersSent = false
  public writableEnded = false

  private readonly headers = new Map<string, string>()

  setHeader(name: string, value: string): this {
    this.headers.set(name.toLowerCase(), value)
    return this
  }

  getHeader(name: string): string | undefined {
    return this.headers.get(name.toLowerCase())
  }

  end = vi.fn(() => {
    this.writableEnded = true
  })

  once(eventName: string | symbol, listener: (...args: unknown[]) => void) {
    return super.once(eventName, listener)
  }
}

describe('http request tracking', () => {
  beforeEach(() => {
    beginTrackedRequestMock.mockReset()
    beginTrackedRequestMock.mockReturnValue(true)
    finishTrackedRequestMock.mockClear()
    resetHttpRequestTrackingForTests()
  })

  afterEach(() => {
    resetHttpRequestTrackingForTests()
  })

  it('rejects new requests with 503 when request drain is active', () => {
    beginTrackedRequestMock.mockReturnValue(false)

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    }

    installHttpRequestTracking(logger)

    const server = new Server()
    const response = new MockResponse()

    const handled = server.emit(
      'request',
      {
        method: 'GET',
        url: '/dashboard',
      },
      response
    )

    expect(handled).toBe(true)
    expect(response.statusCode).toBe(503)
    expect(response.getHeader('retry-after')).toBe('5')
    expect(response.getHeader('connection')).toBe('close')
    expect(response.end).toHaveBeenCalledTimes(1)
    expect(finishTrackedRequestMock).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Rejecting new request while draining')
    )
  })

  it('tracks accepted requests and releases them exactly once on completion', () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    }

    installHttpRequestTracking(logger)

    const server = new Server()
    const response = new MockResponse()

    server.emit(
      'request',
      {
        method: 'POST',
        url: '/api/config/work-locations',
      },
      response
    )

    response.emit('finish')
    response.emit('close')

    expect(beginTrackedRequestMock).toHaveBeenCalledTimes(1)
    expect(finishTrackedRequestMock).toHaveBeenCalledTimes(1)
  })

  it('does not install request tracking more than once', () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    }

    installHttpRequestTracking(logger)
    installHttpRequestTracking(logger)

    expect(logger.info).toHaveBeenCalledTimes(1)
  })
})
