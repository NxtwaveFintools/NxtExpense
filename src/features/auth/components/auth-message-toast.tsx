'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

type AuthMessageToastProps = {
  message: string | null
}

const TOAST_MESSAGES: Record<string, string> = {
  signed_in: 'Signed in successfully.',
  signed_out: 'Signed out successfully.',
}

export function AuthMessageToast({ message }: AuthMessageToastProps) {
  const lastShownMessageRef = useRef<string | null>(null)

  useEffect(() => {
    if (!message || lastShownMessageRef.current === message) {
      return
    }

    const toastMessage = TOAST_MESSAGES[message]
    if (!toastMessage) {
      return
    }

    lastShownMessageRef.current = message
    toast.success(toastMessage)
  }, [message])

  return null
}
