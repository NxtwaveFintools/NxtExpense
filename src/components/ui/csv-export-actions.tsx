'use client'

import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'

type CsvExportActionsProps = {
  exportCurrentPageHref: string
  exportAllHref: string
  buttonClassName?: string
  containerClassName?: string
}

type ExportMode = 'page' | 'all'

const PROGRESS_PULSE_INTERVAL_MS = 120
const FINALIZE_ANIMATION_MS = 460

function mergeClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ')
}

function extractDownloadFilename(
  contentDisposition: string | null,
  fallback: string
) {
  if (!contentDisposition) {
    return fallback
  }

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]).replace(/[\\/:*?"<>|]/g, '-')
  }

  const asciiMatch = /filename="?([^";]+)"?/i.exec(contentDisposition)
  if (asciiMatch?.[1]) {
    return asciiMatch[1].replace(/[\\/:*?"<>|]/g, '-')
  }

  return fallback
}

function triggerFileDownload(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = blobUrl
  link.download = filename
  link.style.display = 'none'

  document.body.append(link)
  link.click()
  link.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl)
  }, 1000)
}

function fallbackToDirectDownload(href: string) {
  const link = document.createElement('a')
  link.href = href
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
}

function ProgressIcon({ progress }: { progress: number }) {
  const angle = Math.min(360, Math.max(0, Math.round(progress * 3.6)))

  return (
    <span
      aria-hidden="true"
      className="relative inline-flex size-3.5 shrink-0 items-center justify-center"
    >
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(currentColor ${angle}deg, rgba(148, 163, 184, 0.35) ${angle}deg 360deg)`,
        }}
      />
      <span className="absolute inset-0.5 rounded-full bg-surface" />
      <span className="absolute inset-1.25 rounded-full bg-current" />
    </span>
  )
}

export function CsvExportActions({
  exportCurrentPageHref,
  exportAllHref,
  buttonClassName,
  containerClassName,
}: CsvExportActionsProps) {
  const [activeMode, setActiveMode] = useState<ExportMode | null>(null)
  const [progress, setProgress] = useState(0)

  const abortControllerRef = useRef<AbortController | null>(null)
  const resetTimerRef = useRef<number | null>(null)
  const progressAnimationFrameRef = useRef<number | null>(null)
  const progressRef = useRef(0)

  const isExporting = activeMode !== null

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }
      if (progressAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(progressAnimationFrameRef.current)
      }
    }
  }, [])

  function setProgressValue(value: number) {
    const normalized = Math.max(0, Math.min(100, Math.round(value)))
    progressRef.current = normalized
    setProgress(normalized)
  }

  function raiseProgressTo(minimum: number) {
    const boundedMinimum = Math.max(0, Math.min(100, Math.round(minimum)))

    setProgress((current) => {
      const next = Math.max(current, boundedMinimum)
      progressRef.current = next
      return next
    })
  }

  function nudgeProgress(maxValue: number) {
    const boundedMaxValue = Math.max(0, Math.min(100, Math.round(maxValue)))

    setProgress((current) => {
      if (current >= boundedMaxValue) {
        progressRef.current = current
        return current
      }

      const increment = current < 25 ? 5 : current < 60 ? 3 : 2
      const next = Math.min(boundedMaxValue, current + increment)
      progressRef.current = next
      return next
    })
  }

  function stopProgressAnimation() {
    if (progressAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(progressAnimationFrameRef.current)
      progressAnimationFrameRef.current = null
    }
  }

  async function animateProgressTo(target: number, durationMs: number) {
    const boundedTarget = Math.max(0, Math.min(100, Math.round(target)))
    const startValue = progressRef.current

    if (boundedTarget <= startValue || durationMs <= 0) {
      setProgressValue(boundedTarget)
      return
    }

    stopProgressAnimation()

    await new Promise<void>((resolve) => {
      const startedAt = performance.now()

      const tick = (now: number) => {
        const elapsed = now - startedAt
        const ratio = Math.min(1, elapsed / durationMs)
        const easedRatio = 1 - Math.pow(1 - ratio, 3)
        const next = Math.round(
          startValue + (boundedTarget - startValue) * easedRatio
        )

        if (next !== progressRef.current) {
          progressRef.current = next
          setProgress(next)
        }

        if (ratio < 1) {
          progressAnimationFrameRef.current = window.requestAnimationFrame(tick)
          return
        }

        progressAnimationFrameRef.current = null
        resolve()
      }

      progressAnimationFrameRef.current = window.requestAnimationFrame(tick)
    })
  }

  function clearProgressWithDelay() {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current)
    }

    resetTimerRef.current = window.setTimeout(() => {
      setActiveMode(null)
      setProgress(0)
      resetTimerRef.current = null
    }, 500)
  }

  async function downloadWithProgress(mode: ExportMode, href: string) {
    if (isExporting) {
      return
    }

    const fallbackName = mode === 'page' ? 'page-export.csv' : 'all-export.csv'
    const controller = new AbortController()
    abortControllerRef.current = controller

    setActiveMode(mode)
    setProgressValue(8)

    let pulseTimer: number | null = window.setInterval(() => {
      nudgeProgress(93)
    }, PROGRESS_PULSE_INTERVAL_MS)

    try {
      const response = await fetch(href, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`CSV export failed with status ${response.status}`)
      }

      const contentDisposition = response.headers.get('content-disposition')
      if (!contentDisposition?.toLowerCase().includes('attachment')) {
        fallbackToDirectDownload(href)
        setActiveMode(null)
        setProgressValue(0)
        return
      }

      const filename = extractDownloadFilename(contentDisposition, fallbackName)

      const totalBytes = Number(response.headers.get('content-length'))
      const hasByteLength = Number.isFinite(totalBytes) && totalBytes > 0

      if (!response.body) {
        raiseProgressTo(80)
        const blob = await response.blob()
        await animateProgressTo(100, FINALIZE_ANIMATION_MS)
        triggerFileDownload(blob, filename)
        clearProgressWithDelay()
        return
      }

      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let receivedBytes = 0

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        if (!value) {
          continue
        }

        const chunkCopy = new Uint8Array(value.byteLength)
        chunkCopy.set(value)

        chunks.push(chunkCopy)
        receivedBytes += chunkCopy.byteLength

        if (hasByteLength) {
          const nextProgress = Math.round((receivedBytes / totalBytes) * 100)
          raiseProgressTo(Math.min(97, Math.max(8, nextProgress)))
        }
      }

      const mergedBytes = new Uint8Array(receivedBytes)
      let offset = 0

      for (const chunk of chunks) {
        mergedBytes.set(chunk, offset)
        offset += chunk.byteLength
      }

      const blob = new Blob([mergedBytes], {
        type: response.headers.get('content-type') ?? 'text/csv; charset=utf-8',
      })

      await animateProgressTo(100, FINALIZE_ANIMATION_MS)
      triggerFileDownload(blob, filename)
      clearProgressWithDelay()
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        fallbackToDirectDownload(href)
      }

      setActiveMode(null)
      setProgressValue(0)
    } finally {
      if (pulseTimer !== null) {
        window.clearInterval(pulseTimer)
        pulseTimer = null
      }
      abortControllerRef.current = null
    }
  }

  const baseButtonClassName =
    'inline-flex items-center gap-1.5 border border-border bg-surface px-3 py-2.5 text-xs font-medium shadow-xs transition-all hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70'

  const progressLabel = Math.max(1, Math.min(100, progress))

  return (
    <div
      className={mergeClassNames(
        'ml-auto flex items-center gap-2',
        containerClassName
      )}
    >
      <button
        type="button"
        onClick={() => void downloadWithProgress('page', exportCurrentPageHref)}
        disabled={isExporting}
        aria-busy={activeMode === 'page'}
        className={mergeClassNames(baseButtonClassName, buttonClassName)}
      >
        {activeMode === 'page' ? (
          <ProgressIcon progress={progressLabel} />
        ) : (
          <Download className="size-3.5" />
        )}
        {activeMode === 'page' ? `Exporting ${progressLabel}%` : 'Page CSV'}
      </button>

      <button
        type="button"
        onClick={() => void downloadWithProgress('all', exportAllHref)}
        disabled={isExporting}
        aria-busy={activeMode === 'all'}
        className={mergeClassNames(baseButtonClassName, buttonClassName)}
      >
        {activeMode === 'all' ? (
          <ProgressIcon progress={progressLabel} />
        ) : (
          <Download className="size-3.5" />
        )}
        {activeMode === 'all' ? `Exporting ${progressLabel}%` : 'All CSV'}
      </button>
    </div>
  )
}
