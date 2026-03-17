'use client'

import { useTransition } from 'react'
import { Loader2, LogOut } from 'lucide-react'
import { toast } from 'sonner'

import { signOutAction } from '@/features/auth/actions'

export function LogoutButton() {
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    toast.info('Signing out...')
    startTransition(() => {
      void signOutAction()
    })
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleLogout}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground shadow-xs transition-all duration-150 hover:bg-error-light hover:text-error hover:border-error/20 disabled:cursor-not-allowed disabled:opacity-60 focus-ring"
      aria-label={isPending ? 'Logging out...' : 'Logout'}
      title={isPending ? 'Logging out...' : 'Logout'}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="size-4" aria-hidden="true" />
      )}
    </button>
  )
}
