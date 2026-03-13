'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

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
      <div className="mx-auto max-w-md space-y-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-500/10">
          <AlertTriangle className="size-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">
          Something went wrong
        </h1>
        <p className="text-sm text-foreground/70">
          An unexpected error occurred. Please try again or contact the admin if
          the issue persists.
        </p>
        {error.digest ? (
          <p className="text-xs text-foreground/50">
            Error reference: {error.digest}
          </p>
        ) : null}
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
