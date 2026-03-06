import { signInWithMicrosoftAction } from '@/features/auth/actions'
import { PasswordLoginForm } from '@/features/auth/components/password-login-form'

type LoginCardProps = {
  errorMessage: string | null
  showDevelopmentForm: boolean
}

export function LoginCard({
  errorMessage,
  showDevelopmentForm,
}: LoginCardProps) {
  return (
    <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-7 shadow-sm">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-foreground/60">
          Internal Finance Platform
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">NxtExpense</h1>
        <p className="text-sm text-foreground/70">Sign in to continue.</p>
      </div>

      <div className="mt-6 space-y-5">
        {errorMessage ? (
          <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {errorMessage}
          </p>
        ) : null}

        <form action={signInWithMicrosoftAction} className="w-full">
          <button
            type="submit"
            className="w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
          >
            Continue with Microsoft
          </button>
        </form>

        {showDevelopmentForm ? (
          <>
            <div className="h-px bg-border" />
            <PasswordLoginForm />
            <p className="text-xs text-foreground/60">
              Email/password login is enabled for development only.
            </p>
          </>
        ) : null}
      </div>
    </section>
  )
}
