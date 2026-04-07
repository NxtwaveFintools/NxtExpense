import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  financeGet: vi.fn(),
  financePost: vi.fn(),
}))

vi.mock('@/app/(app)/finance/export/route', () => ({
  GET: mocks.financeGet,
  POST: mocks.financePost,
}))

import { GET, POST } from '@/app/(app)/approved-history/export/route'

describe('approved-history export alias route', () => {
  it('delegates GET to finance export GET handler', async () => {
    mocks.financeGet.mockResolvedValueOnce(
      new Response('finance-get', { status: 200 })
    )

    const request = new Request('http://localhost:3000/approved-history/export')
    const response = await GET(request)

    expect(await response.text()).toBe('finance-get')
    expect(mocks.financeGet).toHaveBeenCalledWith(request)
  })

  it('delegates POST to finance export POST handler', async () => {
    mocks.financePost.mockResolvedValueOnce(
      new Response('finance-post', { status: 200 })
    )

    const request = new Request(
      'http://localhost:3000/approved-history/export',
      {
        method: 'POST',
      }
    )
    const response = await POST(request)

    expect(await response.text()).toBe('finance-post')
    expect(mocks.financePost).toHaveBeenCalledWith(request)
  })
})
