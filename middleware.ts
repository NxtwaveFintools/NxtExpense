import { NextResponse, type NextRequest } from 'next/server'

import { isAllowedCorporateEmail } from '@/lib/auth/allowed-email-domains'
import { copyResponseCookies } from '@/lib/utils/session-utils'
import { refreshAuthSession } from '@/lib/supabase/middleware'

const protectedRoutes = ['/dashboard']
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
  const { response, user } = await refreshAuthSession(request)
  const { pathname } = request.nextUrl
  const hasSession = Boolean(user)
  const hasAllowedDomain = user ? isAllowedCorporateEmail(user.email) : false

  if (isProtectedRoute(pathname) && !hasAllowedDomain) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = hasSession ? '?error=email_domain_not_allowed' : ''

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
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
