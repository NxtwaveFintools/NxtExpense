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
  const original = process.env.NODE_ENV

  afterEach(() => {
    // restore
    vi.stubEnv('NODE_ENV', original)
  })

  it('returns true when NODE_ENV is development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(isDevelopmentAuthEnabled()).toBe(true)
  })

  it('returns true when NODE_ENV is test', () => {
    vi.stubEnv('NODE_ENV', 'test')
    expect(isDevelopmentAuthEnabled()).toBe(true)
  })

  it('returns false when NODE_ENV is production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(isDevelopmentAuthEnabled()).toBe(false)
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
    expect(msg).toContain('nxtwave')
  })

  it('returns a fallback message for unknown error codes', () => {
    const msg = getLoginErrorMessage('some_unknown_code')
    expect(msg).toBeTruthy()
    expect(typeof msg).toBe('string')
  })
})
