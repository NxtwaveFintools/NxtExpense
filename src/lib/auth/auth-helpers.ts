import { headers } from 'next/headers'

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  oauth_start_failed: 'Unable to start Microsoft login. Please try again.',
  oauth_callback_failed:
    'Sign-in could not be completed. Please sign in again.',
  azure_tenant_url_invalid:
    'Azure Tenant URL is invalid in Supabase. Set it to https://login.microsoftonline.com/<tenant-id> (without /v2.0) or leave it empty.',
  email_domain_not_allowed:
    'Your email domain is not authorized. Please use a corporate email.',
  auth_verification_failed:
    'Unable to verify your session right now. Please try again.',
  inactive_employee:
    'Your employee access is inactive. Please contact your administrator.',
}

function parseBooleanEnvironmentValue(
  value: string | undefined
): boolean | null {
  if (!value) return null

  const normalizedValue = value.trim().toLowerCase()
  if (normalizedValue === 'true' || normalizedValue === '1') return true
  if (normalizedValue === 'false' || normalizedValue === '0') return false
  return null
}

export function isDevelopmentAuthEnabled(): boolean {
  if (process.env.NODE_ENV !== 'production') return true

  const productionOverride = parseBooleanEnvironmentValue(
    process.env.ALLOW_PASSWORD_LOGIN_IN_PROD
  )

  if (productionOverride !== null) return productionOverride

  const vercelEnvironment = process.env.VERCEL_ENV?.trim().toLowerCase()
  return vercelEnvironment !== 'production'
}

/**
 * Returns true if the OAuth URL contains the doubled /v2.0 path segment
 * that Supabase generates when the Azure Tenant URL already includes /v2.0.
 * Callers should redirect to the azure_tenant_url_invalid error page.
 */
export function hasInvalidAzureTenantPath(oauthUrl: string): boolean {
  try {
    const parsedUrl = new URL(oauthUrl)
    return parsedUrl.pathname.includes('/v2.0/oauth2/v2.0/authorize')
  } catch {
    return false
  }
}

function parseFirstHeaderValue(headerValue: string | null): string | null {
  if (!headerValue) return null

  const [firstValue] = headerValue.split(',')
  const normalizedValue = firstValue?.trim()
  return normalizedValue ? normalizedValue : null
}

function parseHttpOrigin(urlValue: string | null): string | null {
  if (!urlValue) return null

  try {
    const parsedUrl = new URL(urlValue)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) return null
    return parsedUrl.origin
  } catch {
    return null
  }
}

function normalizeHost(host: string): string {
  const trimmedHost = host.trim().toLowerCase()
  if (!trimmedHost.startsWith('['))
    return trimmedHost.split(':')[0] ?? trimmedHost

  const ipv6EndIndex = trimmedHost.indexOf(']')
  if (ipv6EndIndex === -1) return trimmedHost
  return trimmedHost.slice(0, ipv6EndIndex + 1)
}

function isLocalhostHost(host: string): boolean {
  const normalizedHost = normalizeHost(host)
  return (
    normalizedHost === 'localhost' ||
    normalizedHost === '127.0.0.1' ||
    normalizedHost === '[::1]'
  )
}

function getProtocolFromOrigin(origin: string | null): string | null {
  if (!origin) return null
  try {
    return new URL(origin).protocol.replace(':', '')
  } catch {
    return null
  }
}

export async function getRequestOrigin(): Promise<string> {
  const requestHeaders = await headers()
  const requestOrigin =
    parseHttpOrigin(requestHeaders.get('origin')) ??
    parseHttpOrigin(requestHeaders.get('referer'))
  const host =
    parseFirstHeaderValue(requestHeaders.get('host')) ??
    parseFirstHeaderValue(requestHeaders.get('x-forwarded-host'))
  const isNonProduction = process.env.NODE_ENV !== 'production'
  const vercelEnvironment = process.env.VERCEL_ENV?.trim().toLowerCase()
  const isPreviewDeployment =
    vercelEnvironment === 'preview' || vercelEnvironment === 'development'
  const isLocalhostRequest = Boolean(
    (host && isLocalhostHost(host)) ||
    (requestOrigin && isLocalhostHost(new URL(requestOrigin).host))
  )
  const forwardedProtocol = parseFirstHeaderValue(
    requestHeaders.get('x-forwarded-proto')
  )
  const protocol =
    (isLocalhostRequest ? 'http' : null) ??
    forwardedProtocol ??
    getProtocolFromOrigin(requestOrigin) ??
    (isNonProduction || isLocalhostRequest ? 'http' : 'https')

  if (requestOrigin && (isNonProduction || isLocalhostRequest)) {
    return requestOrigin
  }

  if (host && (isNonProduction || isLocalhostRequest)) {
    return `${protocol}://${host}`
  }

  if (isPreviewDeployment) {
    if (requestOrigin) return requestOrigin
    if (host) return `${protocol}://${host}`
  }

  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configuredAppUrl) return configuredAppUrl.replace(/\/$/, '')

  if (requestOrigin) return requestOrigin

  if (!host) return 'http://localhost:3000'
  return `${protocol}://${host}`
}

export async function buildOAuthRedirectUrl(
  nextPath = '/dashboard'
): Promise<string> {
  const origin = await getRequestOrigin()
  const callbackUrl = new URL('/auth/callback', origin)

  if (nextPath && nextPath !== '/dashboard') {
    callbackUrl.searchParams.set('next', nextPath)
  }

  return callbackUrl.toString()
}

export function getLoginErrorMessage(
  errorCode: string | null | undefined
): string | null {
  if (!errorCode) return null
  return LOGIN_ERROR_MESSAGES[errorCode] ?? 'Authentication failed.'
}
