'use client'

import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { signInWithMicrosoftAction } from '@/features/auth/actions'

function MicrosoftLogo() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4 shrink-0"
      focusable="false"
    >
      <rect x="1" y="1" width="10" height="10" fill="#f25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7fba00" />
      <rect x="1" y="13" width="10" height="10" fill="#00a4ef" />
      <rect x="13" y="13" width="10" height="10" fill="#ffb900" />
    </svg>
  )
}

export function MicrosoftLoginButton() {
  const [isPending, startTransition] = useTransition()

  function handleMicrosoftSignIn() {
    toast.info('Connecting to Microsoft...')
    startTransition(() => {
      void signInWithMicrosoftAction()
    })
  }

  return (
    <button
      type="button"
      onClick={handleMicrosoftSignIn}
      disabled={isPending}
      className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-ring"
    >
      {isPending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Connecting...
        </>
      ) : (
        <>
          <MicrosoftLogo />
          Continue with Microsoft
        </>
      )}
    </button>
  )
}
