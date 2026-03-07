'use server'

import { redirect } from 'next/navigation'

import {
  buildOAuthRedirectUrl,
  hasInvalidAzureTenantPath,
  isDevelopmentAuthEnabled,
} from '@/lib/auth/auth-helpers'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import {
  signInWithOAuthMutation,
  signInWithPasswordMutation,
  signOutMutation,
} from '@/features/auth/mutations'
import type { AuthActionState } from '@/features/auth/types'
import { emailPasswordLoginSchema } from '@/features/auth/validations'

export async function signInWithMicrosoftAction(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const redirectTo = await buildOAuthRedirectUrl('/dashboard')

  const { url, errorCode } = await signInWithOAuthMutation(supabase, redirectTo)

  if (errorCode || !url) {
    redirect('/login?error=oauth_start_failed')
  }

  if (hasInvalidAzureTenantPath(url!)) {
    redirect('/login?error=azure_tenant_url_invalid')
  }

  redirect(url!)
}

export async function signInWithPasswordAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  if (!isDevelopmentAuthEnabled()) {
    return { error: 'Email/password login is disabled in production.' }
  }

  const parsedCredentials = emailPasswordLoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsedCredentials.success) {
    return {
      error:
        parsedCredentials.error.issues[0]?.message ??
        'Enter valid login credentials.',
    }
  }

  const supabase = await createSupabaseServerClient()
  const { errorMessage } = await signInWithPasswordMutation(
    supabase,
    parsedCredentials.data.email,
    parsedCredentials.data.password
  )

  if (errorMessage) {
    return { error: errorMessage }
  }

  redirect('/dashboard?message=signed_in')
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await signOutMutation(supabase)
  redirect('/login?message=signed_out')
}
