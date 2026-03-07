'use client'

import { useActionState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { signInWithPasswordAction } from '@/features/auth/actions'
import { INITIAL_AUTH_ACTION_STATE } from '@/features/auth/types'

export function PasswordLoginForm() {
  const [state, formAction, isPending] = useActionState(
    signInWithPasswordAction,
    INITIAL_AUTH_ACTION_STATE
  )

  useEffect(() => {
    if (!state.error) {
      return
    }

    toast.error(state.error)
  }, [state.error])

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-3"
      onSubmit={() => toast.info('Signing in...')}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-foreground/80">Email</span>
        <input
          type="email"
          name="email"
          required
          className="rounded-lg border border-border bg-background px-3 py-2 outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-foreground/15"
          autoComplete="email"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-foreground/80">Password</span>
        <input
          type="password"
          name="password"
          required
          className="rounded-lg border border-border bg-background px-3 py-2 outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-foreground/15"
          autoComplete="current-password"
        />
      </label>

      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Signing in...
          </>
        ) : (
          'Sign in with Email'
        )}
      </button>
    </form>
  )
}
