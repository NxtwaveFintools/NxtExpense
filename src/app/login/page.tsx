import { redirect } from 'next/navigation'

import { LoginCard } from '@/features/auth/components/login-card'
import { getCurrentUser } from '@/features/auth/queries'
import {
  isDevelopmentAuthEnabled,
  getLoginErrorMessage,
} from '@/lib/auth/auth-helpers'
import { ThemeToggle } from '@/components/ui/theme-toggle'

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [user, queryParams] = await Promise.all([
    getCurrentUser(),
    searchParams,
  ])

  if (user) {
    redirect('/dashboard')
  }

  const errorValue = queryParams.error
  const errorCode = Array.isArray(errorValue) ? errorValue[0] : errorValue
  const errorMessage = getLoginErrorMessage(errorCode)
  const showDevelopmentForm = isDevelopmentAuthEnabled()

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="absolute right-4 top-4 md:right-8 md:top-8">
        <ThemeToggle />
      </div>
      <LoginCard
        errorMessage={errorMessage}
        showDevelopmentForm={showDevelopmentForm}
      />
    </main>
  )
}
