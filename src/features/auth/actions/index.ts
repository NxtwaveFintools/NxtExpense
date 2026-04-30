'use server'

import { redirect } from 'next/navigation'

import {
  buildOAuthRedirectUrl,
  getLoginErrorMessage,
  hasInvalidAzureTenantPath,
  isDevelopmentAuthEnabled,
} from '@/lib/auth/auth-helpers'
import {
  appendAllowedDomainHint,
  getAllowedCorporateEmailHint,
  isAllowedCorporateEmail,
} from '@/lib/auth/allowed-email-domains'
import { getEmployeeAccessByEmail } from '@/lib/services/employee-service'
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
    return {
      error:
        'Email/password login is disabled in production. Set ALLOW_PASSWORD_LOGIN_IN_PROD=true to enable it.',
    }
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

  let validatedEmail = parsedCredentials.data.email

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    validatedEmail = user?.email ?? parsedCredentials.data.email

    const isAllowedEmail = await isAllowedCorporateEmail(
      supabase,
      validatedEmail
    )

    if (!isAllowedEmail) {
      const hint = await getAllowedCorporateEmailHint(supabase)
      await signOutMutation(supabase)
      return {
        error: appendAllowedDomainHint(
          'Only corporate emails are allowed.',
          hint
        ),
      }
    }
  } catch {
    await signOutMutation(supabase)
    return {
      error: 'Unable to validate corporate email domain. Please try again.',
    }
  }

  try {
    const { accessState } = await getEmployeeAccessByEmail(
      supabase,
      validatedEmail
    )

    if (accessState === 'missing') {
      redirect('/no-access')
    }

    if (accessState === 'inactive') {
      await signOutMutation(supabase)
      return {
        error:
          getLoginErrorMessage('inactive_employee') ??
          'Your employee access has been disabled.',
      }
    }
  } catch {
    await signOutMutation(supabase)
    return {
      error: 'Unable to verify your account access. Please try again.',
    }
  }

  redirect('/dashboard')
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await signOutMutation(supabase)
  redirect('/login?message=signed_out')
}
