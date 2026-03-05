import type { SupabaseClient } from '@supabase/supabase-js'

export type OAuthSignInResult = {
  url: string | null
  errorCode: string | null
}

export type PasswordSignInResult = {
  errorMessage: string | null
}

/**
 * Initiates Microsoft OAuth sign-in flow via Supabase.
 * Returns the OAuth redirect URL or an error code.
 */
export async function signInWithOAuthMutation(
  supabase: SupabaseClient,
  redirectTo: string
): Promise<OAuthSignInResult> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      redirectTo,
      scopes: 'email',
      queryParams: { prompt: 'select_account' },
    },
  })

  if (error || !data.url) {
    return { url: null, errorCode: 'oauth_start_failed' }
  }

  return { url: data.url, errorCode: null }
}

/**
 * Signs in with email and password via Supabase.
 * Returns a structured error message or null on success.
 */
export async function signInWithPasswordMutation(
  supabase: SupabaseClient,
  email: string,
  password: string
): Promise<PasswordSignInResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return { errorMessage: error?.message ?? null }
}

/**
 * Signs the current user out of Supabase.
 */
export async function signOutMutation(supabase: SupabaseClient): Promise<void> {
  await supabase.auth.signOut()
}
