'use client'

import { useEffect } from 'react'

function isLenisEnabled() {
  const rawValue = process.env.NEXT_PUBLIC_ENABLE_LENIS?.trim().toLowerCase()
  return rawValue === 'true' || rawValue === '1'
}

export function LenisProvider() {
  const enabled = isLenisEnabled()

  useEffect(() => {
    if (!enabled) {
      return
    }

    let frameId = 0
    let isMounted = true
    let lenisInstance: {
      raf: (time: number) => void
      destroy: () => void
    } | null = null

    void import('lenis')
      .then(({ default: Lenis }) => {
        if (!isMounted) {
          return
        }

        lenisInstance = new Lenis()

        const onFrame = (time: number) => {
          lenisInstance?.raf(time)
          frameId = window.requestAnimationFrame(onFrame)
        }

        frameId = window.requestAnimationFrame(onFrame)
      })
      .catch(() => undefined)

    return () => {
      isMounted = false
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }
      lenisInstance?.destroy()
    }
  }, [enabled])

  return null
}
