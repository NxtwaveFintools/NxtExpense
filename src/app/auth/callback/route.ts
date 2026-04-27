import { NextResponse } from 'next/server'

import { isAllowedCorporateEmail } from '@/lib/auth/allowed-email-domains'
import { getEmployeeAccessByEmail } from '@/lib/services/employee-service'
import { sanitizeRedirectPath } from '@/lib/utils/session-utils'
import { createSupabaseServerClient } from '@/lib/supabase/server'

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

  if (!(await isAllowedCorporateEmail(supabase, user?.email))) {
    await supabase.auth.signOut()
    return NextResponse.redirect(
      new URL('/login?error=email_domain_not_allowed', requestUrl.origin)
    )
  }

  if (!user?.email) {
    return NextResponse.redirect(new URL('/no-access', requestUrl.origin))
  }

  try {
    const { accessState } = await getEmployeeAccessByEmail(supabase, user.email)

    if (accessState === 'missing') {
      return NextResponse.redirect(new URL('/no-access', requestUrl.origin))
    }

    if (accessState === 'inactive') {
      await supabase.auth.signOut()
      return NextResponse.redirect(
        new URL('/login?error=inactive_employee', requestUrl.origin)
      )
    }
  } catch {
    return NextResponse.redirect(
      new URL('/login?error=auth_verification_failed', requestUrl.origin)
    )
  }

  const redirectPath = sanitizeRedirectPath(nextPath, '/dashboard')
  return NextResponse.redirect(new URL(redirectPath, requestUrl.origin))
}
