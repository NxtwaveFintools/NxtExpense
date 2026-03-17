'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Unhandled error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-md space-y-6 text-center animate-scale-in">
        <div className="mx-auto flex size-20 items-center justify-center rounded-2xl bg-rose-500/10">
          <AlertTriangle className="size-9 text-rose-500" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold text-foreground">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Please try again or contact the admin
            if the issue persists.
          </p>
        </div>
        {error.digest ? (
          <p className="text-xs font-mono text-muted-foreground">
            Error reference: {error.digest}
          </p>
        ) : null}
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover hover:shadow-md active:scale-[0.98]"
        >
          <RotateCw className="size-4" />
          Try again
        </button>
      </div>
    </div>
  )
}
