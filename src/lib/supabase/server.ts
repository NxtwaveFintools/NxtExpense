import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { getSupabasePublicEnv } from '@/lib/supabase/env'

export async function createSupabaseServerClient() {
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
}
