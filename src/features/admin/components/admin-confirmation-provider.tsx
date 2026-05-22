'use client'

import { AlertTriangle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { registerAdminActionConfirmHandler } from '@/features/admin/components/confirm-admin-action'

type Props = {
  children: React.ReactNode
}

export function AdminConfirmationProvider({ children }: Props) {
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const closeDialog = useCallback((confirmed: boolean) => {
    const resolver = resolverRef.current
    resolverRef.current = null
    setMessage(null)

    if (resolver) {
      resolver(confirmed)
    }
  }, [])

  const requestConfirmation = useCallback((nextMessage: string) => {
    if (resolverRef.current) {
      return Promise.resolve(false)
    }

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setMessage(nextMessage)
    })
  }, [])

  useEffect(() => {
    return registerAdminActionConfirmHandler(requestConfirmation)
  }, [requestConfirmation])

  useEffect(() => {
    if (!message) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDialog(false)
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [message, closeDialog])

  useEffect(() => {
    return () => {
      if (resolverRef.current) {
        resolverRef.current(false)
      }
    }
  }, [])

  const lines = useMemo(
    () =>
      (message ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    [message]
  )

  const title = lines[0] ?? 'Confirm admin action'
  const details = lines.slice(1)

  return (
    <>
      {children}
      {message ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-background/55 px-4 backdrop-blur-[1px]"
          role="presentation"
          onClick={() => closeDialog(false)}
          data-testid="admin-confirm-overlay"
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-confirm-title"
            onClick={(event) => event.stopPropagation()}
            data-testid="admin-confirm-dialog"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
                <AlertTriangle className="size-4" />
              </div>
              <div className="space-y-1">
                <h2
                  id="admin-confirm-title"
                  className="text-sm font-semibold text-foreground"
                >
                  {title}
                </h2>
                {details.length > 0 ? (
                  <div className="space-y-1">
                    {details.map((line) => (
                      <p
                        key={line}
                        className="text-xs leading-relaxed text-muted-foreground"
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => closeDialog(false)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                data-testid="admin-confirm-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => closeDialog(true)}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                data-testid="admin-confirm-accept"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
