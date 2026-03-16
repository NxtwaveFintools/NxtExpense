import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: mocks.headers,
}))

import {
  buildOAuthRedirectUrl,
  getLoginErrorMessage,
  getRequestOrigin,
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

describe('request origin helpers', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL
  const originalVercelEnv = process.env.VERCEL_ENV

  afterEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', originalNodeEnv)
    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV
    } else {
      vi.stubEnv('VERCEL_ENV', originalVercelEnv)
    }

    if (originalAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL
      return
    }

    vi.stubEnv('NEXT_PUBLIC_APP_URL', originalAppUrl)
  })

  it('prefers localhost request origin in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.nxtexpense.com')
    mocks.headers.mockResolvedValue(new Headers([['host', 'localhost:3000']]))

    await expect(getRequestOrigin()).resolves.toBe('http://localhost:3000')
  })

  it('prefers browser origin over forwarded host in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.nxtexpense.com')
    mocks.headers.mockResolvedValue(
      new Headers([
        ['origin', 'http://localhost:3000'],
        ['host', 'localhost:3000'],
        [
          'x-forwarded-host',
          'nxt-expense-git-development-fintools-nxtwaves-projects.vercel.app',
        ],
        ['x-forwarded-proto', 'https'],
      ])
    )

    await expect(getRequestOrigin()).resolves.toBe('http://localhost:3000')
  })

  it('prefers host over x-forwarded-host when both are present in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    delete process.env.NEXT_PUBLIC_APP_URL
    mocks.headers.mockResolvedValue(
      new Headers([
        ['host', 'localhost:3000'],
        [
          'x-forwarded-host',
          'nxt-expense-git-development-fintools-nxtwaves-projects.vercel.app',
        ],
        ['x-forwarded-proto', 'https'],
      ])
    )

    await expect(getRequestOrigin()).resolves.toBe('http://localhost:3000')
  })

  it('uses configured app URL in production for non-local hosts', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.nxtexpense.com/')
    delete process.env.VERCEL_ENV
    mocks.headers.mockResolvedValue(
      new Headers([
        ['x-forwarded-host', 'preview.nxtexpense.com'],
        ['x-forwarded-proto', 'https'],
      ])
    )

    await expect(getRequestOrigin()).resolves.toBe('https://app.nxtexpense.com')
  })

  it('uses request host on Vercel preview deployments', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.nxtexpense.com')
    mocks.headers.mockResolvedValue(
      new Headers([
        [
          'host',
          'nxt-expense-git-development-fintools-nxtwaves-projects.vercel.app',
        ],
        ['x-forwarded-proto', 'https'],
      ])
    )

    await expect(getRequestOrigin()).resolves.toBe(
      'https://nxt-expense-git-development-fintools-nxtwaves-projects.vercel.app'
    )
  })

  it('falls back to forwarded request origin when app URL is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    delete process.env.NEXT_PUBLIC_APP_URL
    mocks.headers.mockResolvedValue(
      new Headers([
        ['x-forwarded-host', 'localhost:3000, proxy.example.com'],
        ['x-forwarded-proto', 'http, https'],
      ])
    )

    await expect(getRequestOrigin()).resolves.toBe('http://localhost:3000')
  })

  it('builds an OAuth callback URL with encoded next path', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    delete process.env.NEXT_PUBLIC_APP_URL
    mocks.headers.mockResolvedValue(new Headers([['host', 'localhost:3000']]))

    await expect(buildOAuthRedirectUrl('/dashboard?tab=history')).resolves.toBe(
      'http://localhost:3000/auth/callback?next=%2Fdashboard%3Ftab%3Dhistory'
    )
  })

  it('builds default OAuth callback URL without next query', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    delete process.env.NEXT_PUBLIC_APP_URL
    mocks.headers.mockResolvedValue(new Headers([['host', 'localhost:3000']]))

    await expect(buildOAuthRedirectUrl()).resolves.toBe(
      'http://localhost:3000/auth/callback'
    )
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

  it('returns the correct message for auth_verification_failed', () => {
    const msg = getLoginErrorMessage('auth_verification_failed')
    expect(msg).toBeTruthy()
    expect(typeof msg).toBe('string')
  })

  it('returns a fallback message for unknown error codes', () => {
    const msg = getLoginErrorMessage('some_unknown_code')
    expect(msg).toBeTruthy()
    expect(typeof msg).toBe('string')
  })
})
