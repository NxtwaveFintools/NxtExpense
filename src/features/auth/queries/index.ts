import type { User } from '@supabase/supabase-js'

import { getServerUser, requireServerUser } from '@/lib/session/server-session'

/**
 * Returns the authenticated + domain-verified user, or null.
 * Safe to call from any server component or page.
 * Server-side only.
 */
export async function getCurrentUser(): Promise<User | null> {
  return getServerUser()
}

/**
 * Returns the authenticated user or redirects to the given path.
 * Use this in all protected server pages instead of reaching into lib directly.
 * Server-side only.
 */
export async function requireCurrentUser(redirectTo = '/login'): Promise<User> {
  return requireServerUser(redirectTo)
}
