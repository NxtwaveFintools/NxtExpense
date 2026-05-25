'use client'

type ConfirmHandler = (message: string) => Promise<boolean>

let confirmHandler: ConfirmHandler | null = null

export function registerAdminActionConfirmHandler(handler: ConfirmHandler) {
  confirmHandler = handler

  return () => {
    if (confirmHandler === handler) {
      confirmHandler = null
    }
  }
}

export async function confirmAdminAction(message: string): Promise<boolean> {
  if (!confirmHandler) {
    return false
  }

  return confirmHandler(message)
}
