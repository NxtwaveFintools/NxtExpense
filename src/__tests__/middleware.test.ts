import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { isAllowedCorporateEmailMock, refreshAuthSessionMock } = vi.hoisted(
  () => ({
    isAllowedCorporateEmailMock: vi.fn(),
    refreshAuthSessionMock: vi.fn(),
  })
)

vi.mock('@/lib/auth/allowed-email-domains', () => ({
  isAllowedCorporateEmail: isAllowedCorporateEmailMock,
}))

vi.mock('@/lib/supabase/middleware', () => ({
  refreshAuthSession: refreshAuthSessionMock,
}))

import { middleware } from '../../middleware'

describe('middleware', () => {
  beforeEach(() => {
    isAllowedCorporateEmailMock.mockReset()
    refreshAuthSessionMock.mockReset()
  })

  it('redirects login visits to a one-time session reset message after stale cookie cleanup', async () => {
    refreshAuthSessionMock.mockResolvedValue({
      response: NextResponse.next(),
      user: null,
      supabase: {},
      didResetSession: true,
    })

    const request = new NextRequest('http://localhost:3000/login')
    const response = await middleware(request)

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?message=session_reset'
    )
  })

  it('does not redirect in a loop once the session reset message is already present', async () => {
    refreshAuthSessionMock.mockResolvedValue({
      response: NextResponse.next(),
      user: null,
      supabase: {},
      didResetSession: true,
    })

    const request = new NextRequest(
      'http://localhost:3000/login?message=session_reset'
    )
    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('redirects protected routes to login with the session reset message', async () => {
    refreshAuthSessionMock.mockResolvedValue({
      response: NextResponse.next(),
      user: null,
      supabase: {},
      didResetSession: true,
    })

    const request = new NextRequest('http://localhost:3000/dashboard')
    const response = await middleware(request)

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?message=session_reset'
    )
  })

  it('redirects protected routes to login when session refresh fails', async () => {
    refreshAuthSessionMock.mockRejectedValue(
      new Error('Missing environment variable')
    )

    const request = new NextRequest('http://localhost:3000/dashboard')
    const response = await middleware(request)

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?error=auth_verification_failed'
    )
  })

  it('keeps public auth routes reachable when session refresh fails', async () => {
    refreshAuthSessionMock.mockRejectedValue(
      new Error('Missing environment variable')
    )

    const request = new NextRequest('http://localhost:3000/login')
    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })
})
