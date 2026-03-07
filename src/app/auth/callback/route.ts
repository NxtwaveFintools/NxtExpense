import { NextResponse } from 'next/server'

import { isAllowedCorporateEmail } from '@/lib/auth/allowed-email-domains'
import { sanitizeRedirectPath } from '@/lib/utils/session-utils'
import { createSupabaseServerClient } from '@/lib/supabase/server'

function withSignedInMessage(path: string): string {
  if (!path.startsWith('/dashboard')) {
    return path
  }

  const [pathname, queryString = ''] = path.split('?')
  const searchParams = new URLSearchParams(queryString)

  if (!searchParams.has('message')) {
    searchParams.set('message', 'signed_in')
  }

  const nextQuery = searchParams.toString()
  return nextQuery ? `${pathname}?${nextQuery}` : pathname
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const nextPath = requestUrl.searchParams.get('next')

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=oauth_callback_failed', requestUrl.origin)
    )
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      new URL('/login?error=oauth_callback_failed', requestUrl.origin)
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!isAllowedCorporateEmail(user?.email)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(
      new URL('/login?error=email_domain_not_allowed', requestUrl.origin)
    )
  }

  const redirectPath = sanitizeRedirectPath(nextPath, '/dashboard')
  return NextResponse.redirect(
    new URL(withSignedInMessage(redirectPath), requestUrl.origin)
  )
}
