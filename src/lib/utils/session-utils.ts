import { NextResponse } from 'next/server'

export function copyResponseCookies(
  source: NextResponse,
  destination: NextResponse
): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    destination.cookies.set(cookie)
  })
  return destination
}

/**
 * Sanitizes a redirect path to prevent open redirect attacks.
 * Only allows paths that start with "/" but NOT "//" (protocol-relative URLs).
 */
export function sanitizeRedirectPath(
  path: string | null | undefined,
  fallback = '/dashboard'
): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return fallback
  return path
}
