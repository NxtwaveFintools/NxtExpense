'use client'

import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

const POLL_INTERVAL_MS = 750
const POLL_TIMEOUT_MS = 10 * 60 * 1000
const DONE_RESET_DELAY_MS = 1200

type ButtonState = 'idle' | 'starting' | 'exporting' | 'done'

type StartResponse = { requestId: string } | { error: string }

type StatusResponse =
  | {
      status: 'streaming' | 'done' | 'error'
      rowsSent: number
      estimatedTotalRows: number | null
      errorMessage: string | null
    }
  | { error: string }

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
  const [percent, setPercent] = useState<number | null>(null)

  const pollTimerRef = useRef<number | null>(null)
  const resetTimerRef = useRef<number | null>(null)
  const pollStartedAtRef = useRef<number>(0)

  useEffect(() => {
    return () => {
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current)
      }
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  function stopPolling() {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  function scheduleReset() {
    resetTimerRef.current = window.setTimeout(() => {
      setState('idle')
      setPercent(null)
      resetTimerRef.current = null
    }, DONE_RESET_DELAY_MS)
  }

  async function pollStatus(requestId: string) {
    if (Date.now() - pollStartedAtRef.current > POLL_TIMEOUT_MS) {
      stopPolling()
      setState('idle')
      setPercent(null)
      return
    }

    let data: StatusResponse

    try {
      const response = await fetch(
        `/api/exports/status?requestId=${encodeURIComponent(requestId)}`
      )
      data = await response.json()

      if (!response.ok || 'error' in data) {
        stopPolling()
        setState('idle')
        setPercent(null)
        return
      }
    } catch {
      // Transient network hiccup while polling — keep trying until timeout.
      return
    }

    if (data.status === 'streaming') {
      setState('exporting')
      setPercent(
        data.estimatedTotalRows
          ? Math.min(
              99,
              Math.round((data.rowsSent / data.estimatedTotalRows) * 100)
            )
          : null
      )
      return
    }

    if (data.status === 'done') {
      stopPolling()
      setState('done')
      setPercent(100)
      scheduleReset()
      return
    }

    stopPolling()
    setState('idle')
    setPercent(null)
    toast.error(
      'Export failed partway through — the downloaded file may be incomplete. Please delete it and retry.'
    )
  }

  async function handleClick() {
    if (state !== 'idle') {
      return
    }

    setState('starting')

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

    const { requestId } = data
    url.searchParams.set('requestId', requestId)
    triggerNativeDownload(url.toString())

    setState('exporting')
    setPercent(0)
    pollStartedAtRef.current = Date.now()
    pollTimerRef.current = window.setInterval(() => {
      void pollStatus(requestId)
    }, POLL_INTERVAL_MS)
  }

  const isBusy = state !== 'idle'
  const displayLabel =
    state === 'starting'
      ? 'Starting…'
      : state === 'exporting'
        ? percent !== null
          ? `Exporting ${percent}%`
          : 'Exporting…'
        : state === 'done'
          ? 'Done'
          : label

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
