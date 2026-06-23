'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Wifi, WifiOff } from 'lucide-react'

// How long the "Connected" confirmation stays visible after reconnecting.
const RECONNECTED_NOTICE_DURATION_MS = 4000

function subscribeToOnlineStatus(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

export function NetworkStatusIndicator() {
  const isOnline = useSyncExternalStore(
    subscribeToOnlineStatus,
    () => navigator.onLine,
    () => true
  )
  const [showReconnected, setShowReconnected] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handleOnline() {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      setShowReconnected(true)
      timerRef.current = setTimeout(() => {
        setShowReconnected(false)
        timerRef.current = null
      }, RECONNECTED_NOTICE_DURATION_MS)
    }

    function handleOffline() {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setShowReconnected(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (isOnline && !showReconnected) return null

  const isOffline = !isOnline

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border shadow-xs animate-fade-in ${
        isOffline
          ? 'bg-error-light text-error border-error/20'
          : 'bg-success-light text-success border-success/20'
      }`}
    >
      {isOffline ? (
        <WifiOff className="size-3.5" aria-hidden="true" />
      ) : (
        <Wifi className="size-3.5" aria-hidden="true" />
      )}
      {isOffline ? 'Disconnected' : 'Connected'}
    </span>
  )
}
