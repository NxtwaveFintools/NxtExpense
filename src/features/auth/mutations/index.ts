import type { SupabaseClient } from '@supabase/supabase-js'

const PASSWORD_SIGN_IN_MAX_RETRIES = 2
const PASSWORD_SIGN_IN_RETRY_DELAY_MS = 300

function isTransientNetworkErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase()

  return (
    normalized.includes('fetch failed') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('network') ||
    normalized.includes('timeout') ||
    normalized.includes('connect') ||
    normalized.includes('terminated')
  )
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Unexpected sign-in failure.'
}

async function waitForRetry(attempt: number): Promise<void> {
  await new Promise((resolve) =>
    setTimeout(resolve, PASSWORD_SIGN_IN_RETRY_DELAY_MS * attempt)
  )
}

type OAuthSignInResult = {
  url: string | null
  errorCode: string | null
}

type PasswordSignInResult = {
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
  for (let attempt = 0; attempt <= PASSWORD_SIGN_IN_MAX_RETRIES; attempt += 1) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (!error) {
        return { errorMessage: null }
      }

      const shouldRetry =
        attempt < PASSWORD_SIGN_IN_MAX_RETRIES &&
        isTransientNetworkErrorMessage(error.message)

      if (shouldRetry) {
        await waitForRetry(attempt + 1)
        continue
      }

      return { errorMessage: error.message }
    } catch (error) {
      const message = toErrorMessage(error)
      const shouldRetry =
        attempt < PASSWORD_SIGN_IN_MAX_RETRIES &&
        isTransientNetworkErrorMessage(message)

      if (shouldRetry) {
        await waitForRetry(attempt + 1)
        continue
      }

      return { errorMessage: message }
    }
  }

  return { errorMessage: 'Unexpected sign-in failure.' }
}

/**
 * Signs the current user out of Supabase.
 */
export async function signOutMutation(supabase: SupabaseClient): Promise<void> {
  await supabase.auth.signOut()
}
