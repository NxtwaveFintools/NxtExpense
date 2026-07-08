import { describe, expect, it, vi } from 'vitest'

import {
  buildDatedCsvFilename,
  createCsvExportErrorResponse,
  createExportRouteHandlers,
} from '@/lib/utils/export-route'

describe('export-route utilities', () => {
  it('builds a dated CSV filename with a prefix', () => {
    const filename = buildDatedCsvFilename('claims-history')

    expect(filename).toMatch(/^claims-history-\d{4}-\d{2}-\d{2}\.csv$/)
  })

  it('creates a csv export error response with an explicit status and always sets Content-Disposition', async () => {
    const response = createCsvExportErrorResponse(
      'Finance access is required.',
      403
    )

    expect(response.status).toBe(403)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="export-error.txt"'
    )
    await expect(response.text()).resolves.toBe('Finance access is required.')
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
