type SupabasePublicEnv = {
  url: string
  publishableKey: string
}

type SupabaseServiceEnv = {
  url: string
  serviceRoleKey: string
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  return {
    url: requireEnv(
      'NEXT_PUBLIC_SUPABASE_URL',
      process.env.NEXT_PUBLIC_SUPABASE_URL
    ),
    publishableKey: requireEnv(
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ),
  }
}

export function getSupabaseServiceEnv(): SupabaseServiceEnv {
  return {
    url: requireEnv(
      'NEXT_PUBLIC_SUPABASE_URL',
      process.env.NEXT_PUBLIC_SUPABASE_URL
    ),
    serviceRoleKey: requireEnv(
      'SUPABASE_SERVICE_ROLE_KEY',
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
  }
}
