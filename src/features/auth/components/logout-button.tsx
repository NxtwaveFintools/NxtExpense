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
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="size-4" aria-hidden="true" />
      )}
      {isPending ? 'Logging out...' : 'Logout'}
    </button>
  )
}
