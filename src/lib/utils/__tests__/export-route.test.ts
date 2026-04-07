import { describe, expect, it, vi } from 'vitest'

import {
  buildDatedCsvFilename,
  createCsvErrorResponse,
  createCsvResponse,
  createExportRouteHandlers,
  getExportMode,
} from '@/lib/utils/export-route'

describe('export-route utilities', () => {
  it('resolves export mode from query value', () => {
    expect(getExportMode('all')).toBe('all')
    expect(getExportMode('page')).toBe('page')
    expect(getExportMode(null)).toBe('page')
  })

  it('builds a dated CSV filename with prefix and mode', () => {
    const filename = buildDatedCsvFilename('claims-history', 'all')

    expect(filename).toMatch(/^claims-history-all-\d{4}-\d{2}-\d{2}\.csv$/)
  })

  it('creates a downloadable CSV response', async () => {
    const response = createCsvResponse('a,b', 'claims.csv')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="claims.csv"'
    )
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.text()).resolves.toBe('a,b')
  })

  it('creates csv error response from Error and non-Error values', async () => {
    const fromError = createCsvErrorResponse(new Error('bad request'))
    const fromUnknown = createCsvErrorResponse({ code: 'E_BAD' }, 'fallback')

    expect(fromError.status).toBe(400)
    expect(await fromError.text()).toBe('bad request')

    expect(fromUnknown.status).toBe(400)
    expect(await fromUnknown.text()).toBe('fallback')
  })

  it('returns GET/POST handlers that delegate to provided handler', async () => {
    const handler = vi.fn(
      async (request: Request) => new Response(request.method, { status: 200 })
    )

    const routes = createExportRouteHandlers(handler)

    const getResponse = await routes.GET(
      new Request('https://example.com', { method: 'GET' })
    )
    const postResponse = await routes.POST(
      new Request('https://example.com', { method: 'POST' })
    )

    expect(handler).toHaveBeenCalledTimes(2)
    expect(await getResponse.text()).toBe('GET')
    expect(await postResponse.text()).toBe('POST')
  })
})
