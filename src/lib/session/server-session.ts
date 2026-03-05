import type { User } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

import { isAllowedCorporateEmail } from '@/lib/auth/allowed-email-domains'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Returns the authenticated user after verifying:
 * 1. A valid Supabase session exists
 * 2. The user's email belongs to an allowed corporate domain
 *
 * Signs the user out and returns null if either check fails.
 * Server-side only.
 */
export async function getServerUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null

  if (!isAllowedCorporateEmail(user.email)) {
    await supabase.auth.signOut()
    return null
  }

  return user
}

/**
 * Returns the authenticated user or redirects to the given path.
 * Use in protected server components and page.tsx files.
 * Server-side only.
 */
export async function requireServerUser(redirectTo = '/login'): Promise<User> {
  const user = await getServerUser()
  if (!user) redirect(redirectTo)
  return user
}
