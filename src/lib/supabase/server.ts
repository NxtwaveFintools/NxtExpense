import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

import { getSupabasePublicEnv } from '@/lib/supabase/env'

/**
 * Returns a Supabase client bound to the current request's cookies.
 *
 * Wrapped in React cache() so every caller within a single request shares one
 * client instance. This matters because a Server Component / Server Action
 * render context cannot persist a refreshed auth token back to cookies — if
 * each caller created its own client, the first would consume the (single-use,
 * rotating) refresh token and every later client would read the now-stale
 * cookie and fail to authenticate. One shared client refreshes once and reuses
 * the in-memory session for the rest of the request.
 */
export const createSupabaseServerClient = cache(async () => {
  const cookieStore = await cookies()
  const { url, publishableKey } = getSupabasePublicEnv()

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Intentionally suppressed: setAll() will throw when called from a
          // Server Component (read-only cookie context). This is expected — the
          // session will be refreshed on the next request via the middleware.
        }
      },
    },
  })
})
