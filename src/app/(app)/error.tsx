'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCw, ArrowRight } from 'lucide-react'

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
      <div className="mx-auto max-w-md space-y-6 text-center animate-scale-in">
        <div className="mx-auto flex size-20 items-center justify-center rounded-2xl bg-rose-500/10">
          <AlertTriangle className="size-9 text-rose-500" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold text-foreground">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground">
            An error occurred while loading this page. Please try again.
          </p>
        </div>
        {error.digest ? (
          <p className="text-xs font-mono text-muted-foreground">
            Error reference: {error.digest}
          </p>
        ) : null}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover hover:shadow-md active:scale-[0.98]"
          >
            <RotateCw className="size-4" />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-medium shadow-xs transition-all hover:bg-muted"
          >
            Dashboard
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
