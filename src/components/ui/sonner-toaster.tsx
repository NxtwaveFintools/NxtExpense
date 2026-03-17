'use client'

import { Toaster } from 'sonner'
import { CheckCircle2, Info, AlertCircle, XCircle } from 'lucide-react'

export function SonnerToaster() {
  return (
    <Toaster
      position="top-center"
      offset="24px"
      gap={8}
      visibleToasts={4}
      closeButton
      duration={2000}
      icons={{
        success: (
          <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/15 dark:bg-emerald-500/20">
            <CheckCircle2
              className="size-[18px] text-emerald-600 dark:text-emerald-400"
              strokeWidth={2.5}
            />
          </div>
        ),
        info: (
          <div className="flex size-8 items-center justify-center rounded-xl bg-blue-500/15 dark:bg-blue-500/20">
            <Info
              className="size-[18px] text-blue-600 dark:text-blue-400"
              strokeWidth={2.5}
            />
          </div>
        ),
        warning: (
          <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/15 dark:bg-amber-500/20">
            <AlertCircle
              className="size-[18px] text-amber-600 dark:text-amber-400"
              strokeWidth={2.5}
            />
          </div>
        ),
        error: (
          <div className="flex size-8 items-center justify-center rounded-xl bg-rose-500/15 dark:bg-rose-500/20">
            <XCircle
              className="size-[18px] text-rose-600 dark:text-rose-400"
              strokeWidth={2.5}
            />
          </div>
        ),
      }}
    />
  )
}
