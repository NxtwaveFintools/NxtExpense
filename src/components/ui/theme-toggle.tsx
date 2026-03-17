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
      className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground shadow-xs transition-all duration-150 hover:bg-muted hover:text-foreground focus-ring"
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
    </button>
  )
}
