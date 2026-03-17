import { MicrosoftLoginButton } from '@/features/auth/components/microsoft-login-button'
import { PasswordLoginForm } from '@/features/auth/components/password-login-form'

type LoginCardProps = {
  errorMessage: string | null
  showPasswordForm: boolean
}

export function LoginCard({ errorMessage, showPasswordForm }: LoginCardProps) {
  return (
    <section className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-lg animate-scale-in">
      <div className="space-y-2">
        <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-primary/10">
          <svg
            viewBox="0 0 24 24"
            className="size-6 text-primary"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
          </svg>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Internal Finance Platform
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          NxtExpense
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your account to continue.
        </p>
      </div>

      <div className="mt-8 space-y-5">
        {errorMessage ? (
          <p className="rounded-lg border border-error/20 bg-error-light px-4 py-3 text-sm text-error">
            {errorMessage}
          </p>
        ) : null}

        <MicrosoftLoginButton />

        {showPasswordForm ? (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface px-3 text-muted-foreground">
                  or continue with email
                </span>
              </div>
            </div>
            <PasswordLoginForm />
            <p className="text-center text-xs text-muted-foreground">
              Email/password login is enabled for internal testing.
            </p>
          </>
        ) : null}
      </div>
    </section>
  )
}
