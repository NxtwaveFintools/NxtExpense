'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

type ButtonState = 'idle' | 'preparing'

type StartResponse = { ok: true } | { error: string }

export type CsvExportButtonProps = {
  exportType: string
  href: string
  label: string
  className?: string
}

function mergeClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ')
}

function triggerNativeDownload(href: string) {
  const link = document.createElement('a')
  link.href = href
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
}

export function CsvExportButton({
  exportType,
  href,
  label,
  className,
}: CsvExportButtonProps) {
  const [state, setState] = useState<ButtonState>('idle')

  async function handleClick() {
    if (state !== 'idle') {
      return
    }

    setState('preparing')

    const url = new URL(href, window.location.origin)

    let data: StartResponse

    try {
      const response = await fetch('/api/exports/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exportType, query: url.search }),
      })
      data = await response.json()

      if (!response.ok || 'error' in data) {
        setState('idle')
        toast.error('error' in data ? data.error : 'Unable to start export.')
        return
      }
    } catch {
      setState('idle')
      toast.error('Unable to start export.')
      return
    }

    triggerNativeDownload(url.toString())
    setState('idle')
  }

  const isBusy = state !== 'idle'
  const displayLabel = state === 'preparing' ? 'Preparing export…' : label

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isBusy}
      aria-busy={isBusy}
      className={mergeClassNames(
        'inline-flex items-center gap-1.5 border border-border bg-surface px-3 py-2.5 text-xs font-medium shadow-xs transition-all hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70',
        className
      )}
    >
      <Download className="size-3.5" />
      {displayLabel}
    </button>
  )
}
