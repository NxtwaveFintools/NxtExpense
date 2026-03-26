import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  isAllowedCorporateEmailMock,
  refreshAuthSessionMock,
  clearSupabaseAuthCookiesMock,
} = vi.hoisted(() => ({
  isAllowedCorporateEmailMock: vi.fn(),
  refreshAuthSessionMock: vi.fn(),
  clearSupabaseAuthCookiesMock: vi.fn(() => true),
}))

vi.mock('@/lib/auth/allowed-email-domains', () => ({
  isAllowedCorporateEmail: isAllowedCorporateEmailMock,
}))

vi.mock('@/lib/supabase/env', () => ({
  getSupabasePublicEnv: () => ({
    url: 'https://acbgmixcdtfgurgbkqgh.supabase.co',
    publishableKey: 'test-publishable-key',
  }),
}))

vi.mock('@/lib/supabase/middleware', () => ({
  refreshAuthSession: refreshAuthSessionMock,
  clearSupabaseAuthCookies: clearSupabaseAuthCookiesMock,
}))

import { middleware } from '../../middleware'

describe('middleware', () => {
  beforeEach(() => {
    isAllowedCorporateEmailMock.mockReset()
    refreshAuthSessionMock.mockReset()
    clearSupabaseAuthCookiesMock.mockClear()
  })

  it('redirects login visits to a one-time session reset message after stale cookie cleanup', async () => {
    refreshAuthSessionMock.mockResolvedValue({
      response: NextResponse.next(),
      user: null,
      supabase: {},
      didResetSession: true,
      didEncounterStaleRefreshToken: false,
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
      didEncounterStaleRefreshToken: false,
    })

    const request = new NextRequest(
      'http://localhost:3000/login?message=session_reset'
    )
    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('retries protected route once when stale refresh token is detected', async () => {
    refreshAuthSessionMock.mockResolvedValue({
      response: NextResponse.next(),
      user: null,
      supabase: {},
      didResetSession: false,
      didEncounterStaleRefreshToken: true,
    })

    const request = new NextRequest('http://localhost:3000/dashboard')
    const response = await middleware(request)

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/dashboard?auth_retry=1'
    )
  })

  it('redirects to login with session reset after stale retry is exhausted', async () => {
    refreshAuthSessionMock.mockResolvedValue({
      response: NextResponse.next(),
      user: null,
      supabase: {},
      didResetSession: false,
      didEncounterStaleRefreshToken: true,
    })

    const request = new NextRequest(
      'http://localhost:3000/dashboard?auth_retry=1',
      {
        headers: {
          cookie: 'sb-acbgmixcdtfgurgbkqgh-auth-token=stale-token',
        },
      }
    )
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
