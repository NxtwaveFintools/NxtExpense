import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createServerClientMock, getUserMock } = vi.hoisted(() => {
  const getUserMock = vi.fn()

  return {
    getUserMock,
    createServerClientMock: vi.fn(() => ({
      auth: {
        getUser: getUserMock,
      },
    })),
  }
})

vi.mock('@supabase/ssr', () => ({
  createServerClient: createServerClientMock,
}))

vi.mock('@/lib/supabase/env', () => ({
  getSupabasePublicEnv: () => ({
    url: 'https://acbgmixcdtfgurgbkqgh.supabase.co',
    publishableKey: 'test-publishable-key',
  }),
}))

import { refreshAuthSession } from '../middleware'

describe('refreshAuthSession', () => {
  beforeEach(() => {
    createServerClientMock.mockClear()
    getUserMock.mockReset()
  })

  it('returns the resolved user when the Supabase session is valid', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'finance.user@nxtwave.co.in',
        },
      },
      error: null,
    })

    const request = new NextRequest('http://localhost:3000/login')
    const result = await refreshAuthSession(request)

    expect(result.user).toMatchObject({
      id: 'user-1',
      email: 'finance.user@nxtwave.co.in',
    })
    expect(result.didResetSession).toBe(false)
  })

  it('marks stale refresh token errors without eagerly clearing auth cookies', async () => {
    getUserMock.mockRejectedValue({
      __isAuthError: true,
      status: 400,
      code: 'refresh_token_not_found',
    })

    const request = new NextRequest('http://localhost:3000/login', {
      headers: {
        cookie: [
          'sb-acbgmixcdtfgurgbkqgh-auth-token=access-token',
          'sb-acbgmixcdtfgurgbkqgh-auth-token.0=chunk-0',
          'sb-acbgmixcdtfgurgbkqgh-auth-token-code-verifier=verifier',
          'theme=dark',
        ].join('; '),
      },
    })

    const result = await refreshAuthSession(request)

    expect(result.user).toBeNull()
    expect(result.didResetSession).toBe(false)
    expect(result.didEncounterStaleRefreshToken).toBe(true)
    expect(
      request.cookies.get('sb-acbgmixcdtfgurgbkqgh-auth-token')?.value
    ).toBe('access-token')
    expect(
      request.cookies.get('sb-acbgmixcdtfgurgbkqgh-auth-token.0')?.value
    ).toBe('chunk-0')
    expect(request.cookies.get('theme')?.value).toBe('dark')
    expect(
      result.response.cookies.get('sb-acbgmixcdtfgurgbkqgh-auth-token')
    ).toBeUndefined()
  })

  it('treats missing auth session as signed-out without stale refresh handling', async () => {
    getUserMock.mockRejectedValue({
      __isAuthError: true,
      status: 400,
      name: 'AuthSessionMissingError',
      message: 'Auth session missing!',
    })

    const request = new NextRequest('http://localhost:3000/login')
    const result = await refreshAuthSession(request)

    expect(result.user).toBeNull()
    expect(result.didResetSession).toBe(false)
    expect(result.didEncounterStaleRefreshToken).toBe(false)
  })
})
