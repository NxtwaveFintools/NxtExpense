import { describe, expect, it } from 'vitest'

import { isSessionRecoverableError } from '@/lib/supabase/auth-errors'

describe('isSessionRecoverableError', () => {
  it('detects Supabase AuthError objects for stale refresh tokens', () => {
    const error = {
      __isAuthError: true,
      code: 'refresh_token_not_found',
      message: 'Refresh token not found',
    }

    expect(isSessionRecoverableError(error)).toBe(true)
  })

  it('detects a plain Error carrying a PostgREST "JWT expired" message', () => {
    expect(isSessionRecoverableError(new Error('JWT expired'))).toBe(true)
  })

  it('detects a plain Error for an invalid refresh token', () => {
    expect(
      isSessionRecoverableError(
        new Error('Invalid Refresh Token: Refresh Token Not Found')
      )
    ).toBe(true)
  })

  it('detects a plain Error for a missing auth session', () => {
    expect(isSessionRecoverableError(new Error('Auth session missing!'))).toBe(
      true
    )
  })

  it('detects a raw string message', () => {
    expect(isSessionRecoverableError('invalid JWT')).toBe(true)
  })

  it('does not treat a generic data error as recoverable', () => {
    expect(
      isSessionRecoverableError(new Error('Claim owner mapping not found.'))
    ).toBe(false)
  })

  it('does not misfire on domain errors that mention "claim"', () => {
    expect(isSessionRecoverableError(new Error('Invalid claim status'))).toBe(
      false
    )
  })

  it('returns false for null, undefined, and empty messages', () => {
    expect(isSessionRecoverableError(null)).toBe(false)
    expect(isSessionRecoverableError(undefined)).toBe(false)
    expect(isSessionRecoverableError(new Error(''))).toBe(false)
  })
})
