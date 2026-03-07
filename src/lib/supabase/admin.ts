import { createClient } from '@supabase/supabase-js'

import { getSupabaseServiceEnv } from '@/lib/supabase/env'

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseServiceEnv()

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
