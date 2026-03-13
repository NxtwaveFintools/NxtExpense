'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="mx-auto max-w-md space-y-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-500/10">
          <AlertTriangle className="size-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">
          Something went wrong
        </h1>
        <p className="text-sm text-foreground/70">
          An error occurred while loading this page. Please try again.
        </p>
        {error.digest ? (
          <p className="text-xs text-foreground/50">
            Error reference: {error.digest}
          </p>
        ) : null}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
