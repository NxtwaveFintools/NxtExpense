import { headers } from 'next/headers'

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  oauth_start_failed: 'Unable to start Microsoft login. Please try again.',
  oauth_callback_failed:
    'Sign-in could not be completed. Please sign in again.',
  azure_tenant_url_invalid:
    'Azure Tenant URL is invalid in Supabase. Set it to https://login.microsoftonline.com/<tenant-id> (without /v2.0) or leave it empty.',
  email_domain_not_allowed:
    'Only @nxtwave.co.in, @nxtwave.tech, and @nxtwave.in emails are allowed.',
}

export function isDevelopmentAuthEnabled(): boolean {
  return process.env.NODE_ENV !== 'production'
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

export async function getRequestOrigin(): Promise<string> {
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL
  if (configuredAppUrl) return configuredAppUrl.replace(/\/$/, '')

  const requestHeaders = await headers()
  const host =
    requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http'
  if (!host) return 'http://localhost:3000'
  return `${protocol}://${host}`
}

export async function buildOAuthRedirectUrl(
  nextPath = '/dashboard'
): Promise<string> {
  const origin = await getRequestOrigin()
  return `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
}

export function getLoginErrorMessage(
  errorCode: string | null | undefined
): string | null {
  if (!errorCode) return null
  return LOGIN_ERROR_MESSAGES[errorCode] ?? 'Authentication failed.'
}
