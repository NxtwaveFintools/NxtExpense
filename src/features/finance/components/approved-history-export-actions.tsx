'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'

type ApprovedHistoryExportActionsProps = {
  exportAllHref: string
  exportBcExpenseHref: string
  exportPaymentJournalsHref: string
  buttonClassName?: string
  containerClassName?: string
}

type ExportMode = 'all' | 'bc' | 'payment-journals'

function mergeClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ')
}

function triggerDownload(href: string) {
  const link = document.createElement('a')
  link.href = href
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
}

export function ApprovedHistoryExportActions({
  exportAllHref,
  exportBcExpenseHref,
  exportPaymentJournalsHref,
  buttonClassName,
  containerClassName,
}: ApprovedHistoryExportActionsProps) {
  const [activeMode, setActiveMode] = useState<ExportMode | null>(null)
  const resetTimerRef = useRef<number | null>(null)

  const isExporting = activeMode !== null

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  async function handleDownload(mode: ExportMode, href: string) {
    if (isExporting) {
      return
    }

    setActiveMode(mode)

    try {
      triggerDownload(href)
    } finally {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }

      resetTimerRef.current = window.setTimeout(() => {
        setActiveMode(null)
        resetTimerRef.current = null
      }, 500)
    }
  }

  const baseButtonClassName =
    'inline-flex items-center gap-1.5 border border-border bg-surface px-3 py-2.5 text-xs font-medium shadow-xs transition-all hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70'

  return (
    <div
      className={mergeClassNames(
        'ml-auto flex items-center gap-2',
        containerClassName
      )}
    >
      <button
        type="button"
        onClick={() => void handleDownload('all', exportAllHref)}
        disabled={isExporting}
        className={mergeClassNames(baseButtonClassName, buttonClassName)}
      >
        <Download className="size-3.5" />
        {activeMode === 'all' ? 'Exporting...' : 'All CSV'}
      </button>

      <button
        type="button"
        onClick={() => void handleDownload('bc', exportBcExpenseHref)}
        disabled={isExporting}
        className={mergeClassNames(baseButtonClassName, buttonClassName)}
      >
        <FileSpreadsheet className="size-3.5" />
        {activeMode === 'bc' ? 'Exporting...' : 'BC Expense'}
      </button>

      <button
        type="button"
        disabled={isExporting}
        onClick={() =>
          void handleDownload('payment-journals', exportPaymentJournalsHref)
        }
        className={mergeClassNames(baseButtonClassName, buttonClassName)}
      >
        {activeMode === 'payment-journals'
          ? 'Exporting...'
          : 'Payment Journals'}
      </button>
    </div>
  )
}
