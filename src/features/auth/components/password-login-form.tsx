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
      className="flex w-full flex-col gap-4"
      onSubmit={() => toast.info('Signing in...')}
    >
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Email</span>
        <input
          type="email"
          name="email"
          required
          className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none transition-all duration-150 focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
          autoComplete="email"
          placeholder="you@company.com"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Password</span>
        <input
          type="password"
          name="password"
          required
          className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none transition-all duration-150 focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
          autoComplete="current-password"
          placeholder="••••••••"
        />
      </label>

      {state.error ? (
        <p className="text-sm text-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 text-sm font-semibold text-foreground shadow-xs transition-all duration-150 hover:bg-muted hover:shadow-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-ring"
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
