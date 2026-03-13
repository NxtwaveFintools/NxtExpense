import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getLoginErrorMessage,
  hasInvalidAzureTenantPath,
  isDevelopmentAuthEnabled,
} from '../auth-helpers'

describe('hasInvalidAzureTenantPath', () => {
  it('returns true when URL contains doubled /v2.0 path', () => {
    const badUrl =
      'https://login.microsoftonline.com/tenant-id/v2.0/oauth2/v2.0/authorize?...'
    expect(hasInvalidAzureTenantPath(badUrl)).toBe(true)
  })

  it('returns false for a correctly formed Azure OAuth URL', () => {
    const goodUrl =
      'https://login.microsoftonline.com/tenant-id/oauth2/v2.0/authorize?...'
    expect(hasInvalidAzureTenantPath(goodUrl)).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(hasInvalidAzureTenantPath('')).toBe(false)
  })

  it('returns false for a completely invalid URL', () => {
    expect(hasInvalidAzureTenantPath('not-a-url')).toBe(false)
  })

  it('returns false for a valid non-azure URL', () => {
    expect(hasInvalidAzureTenantPath('https://example.com/oauth2/token')).toBe(
      false
    )
  })
})

describe('isDevelopmentAuthEnabled', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalProductionFlag = process.env.ALLOW_PASSWORD_LOGIN_IN_PROD

  afterEach(() => {
    vi.stubEnv('NODE_ENV', originalNodeEnv)

    if (originalProductionFlag === undefined) {
      delete process.env.ALLOW_PASSWORD_LOGIN_IN_PROD
      return
    }

    vi.stubEnv('ALLOW_PASSWORD_LOGIN_IN_PROD', originalProductionFlag)
  })

  it('returns true when NODE_ENV is development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(isDevelopmentAuthEnabled()).toBe(true)
  })

  it('returns true when NODE_ENV is test', () => {
    vi.stubEnv('NODE_ENV', 'test')
    expect(isDevelopmentAuthEnabled()).toBe(true)
  })

  it('returns false in production when the flag is missing', () => {
    vi.stubEnv('NODE_ENV', 'production')
    delete process.env.ALLOW_PASSWORD_LOGIN_IN_PROD
    expect(isDevelopmentAuthEnabled()).toBe(false)
  })

  it('returns false in production when the flag is not a truthy value', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ALLOW_PASSWORD_LOGIN_IN_PROD', 'false')
    expect(isDevelopmentAuthEnabled()).toBe(false)
  })

  it('returns true in production when the flag is true', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ALLOW_PASSWORD_LOGIN_IN_PROD', 'true')
    expect(isDevelopmentAuthEnabled()).toBe(true)
  })

  it('returns true in production when the flag is 1', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ALLOW_PASSWORD_LOGIN_IN_PROD', '1')
    expect(isDevelopmentAuthEnabled()).toBe(true)
  })
})

describe('getLoginErrorMessage', () => {
  it('returns null for null input', () => {
    expect(getLoginErrorMessage(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(getLoginErrorMessage(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(getLoginErrorMessage('')).toBeNull()
  })

  it('returns the correct message for oauth_start_failed', () => {
    const msg = getLoginErrorMessage('oauth_start_failed')
    expect(msg).toBeTruthy()
    expect(typeof msg).toBe('string')
  })

  it('returns the correct message for oauth_callback_failed', () => {
    const msg = getLoginErrorMessage('oauth_callback_failed')
    expect(msg).toBeTruthy()
  })

  it('returns the correct message for azure_tenant_url_invalid', () => {
    const msg = getLoginErrorMessage('azure_tenant_url_invalid')
    expect(msg).toBeTruthy()
    expect(msg).toContain('Azure')
  })

  it('returns the correct message for email_domain_not_allowed', () => {
    const msg = getLoginErrorMessage('email_domain_not_allowed')
    expect(msg).toBeTruthy()
    expect(typeof msg).toBe('string')
  })

  it('returns a fallback message for unknown error codes', () => {
    const msg = getLoginErrorMessage('some_unknown_code')
    expect(msg).toBeTruthy()
    expect(typeof msg).toBe('string')
  })
})
