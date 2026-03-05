'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
  const hasResolvedTheme =
    isHydrated && (resolvedTheme === 'dark' || resolvedTheme === 'light')
  const isDarkTheme = hasResolvedTheme && resolvedTheme === 'dark'
  const nextTheme = isDarkTheme ? 'light' : 'dark'
  const label = hasResolvedTheme
    ? isDarkTheme
      ? 'Light mode'
      : 'Dark mode'
    : 'Theme'

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      disabled={!hasResolvedTheme}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition hover:bg-muted"
      aria-label={`Switch to ${label}`}
      title={`Switch to ${label}`}
    >
      {!hasResolvedTheme ? (
        <Monitor className="size-4" />
      ) : isDarkTheme ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
      <span>{label}</span>
    </button>
  )
}
