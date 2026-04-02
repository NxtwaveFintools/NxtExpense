import { redirect } from 'next/navigation'

import { AuthMessageToast } from '@/features/auth/components/auth-message-toast'
import { LoginCard } from '@/features/auth/components/login-card'
import { getCurrentUser } from '@/features/auth/queries'
import { getEmployeeByEmail } from '@/lib/services/employee-service'
import {
  isDevelopmentAuthEnabled,
  getLoginErrorMessage,
} from '@/lib/auth/auth-helpers'
import {
  appendAllowedDomainHint,
  getAllowedCorporateEmailHint,
} from '@/lib/auth/allowed-email-domains'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ThemeToggle } from '@/components/ui/theme-toggle'

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [user, queryParams] = await Promise.all([
    getCurrentUser(),
    searchParams,
  ])

  if (user?.email) {
    try {
      const supabase = await createSupabaseServerClient()
      const employee = await getEmployeeByEmail(supabase, user.email)

      if (employee) {
        redirect('/dashboard')
      }

      redirect('/no-access')
    } catch {
      redirect('/no-access')
    }
  }

  if (user) {
    redirect('/no-access')
  }

  const errorValue = queryParams.error
  const errorCode = Array.isArray(errorValue) ? errorValue[0] : errorValue
  const messageValue = queryParams.message
  const messageCode = Array.isArray(messageValue)
    ? messageValue[0]
    : messageValue
  let errorMessage = getLoginErrorMessage(errorCode)
  if (errorCode === 'email_domain_not_allowed') {
    try {
      const supabase = await createSupabaseServerClient()
      const hint = await getAllowedCorporateEmailHint(supabase)
      errorMessage = appendAllowedDomainHint(
        'Your email domain is not authorized. Please use a corporate email.',
        hint
      )
    } catch {
      // Keep generic fallback if DB is unavailable
    }
  }
  const showPasswordForm = isDevelopmentAuthEnabled()

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <AuthMessageToast message={messageCode ?? null} />

      {/* Decorative background pattern */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-48 -right-48 size-96 rounded-full bg-primary/5" />
        <div className="absolute -bottom-48 -left-48 size-96 rounded-full bg-primary/5" />
      </div>

      <div className="absolute right-4 top-4 md:right-8 md:top-8">
        <ThemeToggle />
      </div>
      <LoginCard
        errorMessage={errorMessage}
        showPasswordForm={showPasswordForm}
      />
    </main>
  )
}
