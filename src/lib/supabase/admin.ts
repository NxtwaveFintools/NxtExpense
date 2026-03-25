import { createClient } from '@supabase/supabase-js'

import { getSupabasePublicEnv } from '@/lib/supabase/env'

function requireServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!key) {
    throw new Error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY')
  }

  return key
}

export function createSupabaseAdminClient() {
  const { url } = getSupabasePublicEnv()
  const serviceRoleKey = requireServiceRoleKey()

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
