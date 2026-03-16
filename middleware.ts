import { NextResponse, type NextRequest } from 'next/server'

import { isAllowedCorporateEmail } from '@/lib/auth/allowed-email-domains'
import { copyResponseCookies } from '@/lib/utils/session-utils'
import { refreshAuthSession } from '@/lib/supabase/middleware'

const protectedRoutes = [
  '/dashboard',
  '/claims',
  '/approvals',
  '/finance',
  '/admin',
]
const publicAuthRoutes = ['/login']

function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`)
}

function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some((route) => matchesRoute(pathname, route))
}

function isPublicAuthRoute(pathname: string): boolean {
  return publicAuthRoutes.some((route) => matchesRoute(pathname, route))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  try {
    const { response, user, supabase, didResetSession } =
      await refreshAuthSession(request)
    const hasSession = Boolean(user)

    let hasAllowedDomain = false
    let didDomainValidationFail = false

    if (user) {
      try {
        hasAllowedDomain = await isAllowedCorporateEmail(supabase, user.email)
      } catch (error) {
        didDomainValidationFail = true
        console.error(
          '[middleware] Failed to validate corporate email domain',
          error
        )
      }
    }

    if (isProtectedRoute(pathname) && !hasAllowedDomain) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.search = ''

      if (hasSession) {
        loginUrl.searchParams.set(
          'error',
          didDomainValidationFail
            ? 'auth_verification_failed'
            : 'email_domain_not_allowed'
        )
      } else if (didResetSession) {
        loginUrl.searchParams.set('message', 'session_reset')
      }

      const redirectResponse = NextResponse.redirect(loginUrl)
      return copyResponseCookies(response, redirectResponse)
    }

    if (
      didResetSession &&
      isPublicAuthRoute(pathname) &&
      request.nextUrl.searchParams.get('message') !== 'session_reset'
    ) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.searchParams.set('message', 'session_reset')

      const redirectResponse = NextResponse.redirect(loginUrl)
      return copyResponseCookies(response, redirectResponse)
    }

    if (isPublicAuthRoute(pathname) && hasAllowedDomain) {
      const dashboardUrl = request.nextUrl.clone()
      dashboardUrl.pathname = '/dashboard'
      dashboardUrl.search = ''

      const redirectResponse = NextResponse.redirect(dashboardUrl)
      return copyResponseCookies(response, redirectResponse)
    }

    return response
  } catch (error) {
    console.error('[middleware] Session refresh failed', error)

    if (isProtectedRoute(pathname)) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.search = ''
      loginUrl.searchParams.set('error', 'auth_verification_failed')
      return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/claims/:path*',
    '/approvals/:path*',
    '/finance/:path*',
    '/admin/:path*',
    '/login',
  ],
}
