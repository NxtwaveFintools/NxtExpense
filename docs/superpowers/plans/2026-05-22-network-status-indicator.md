# Network Status Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real-time internet connection status pill to the navbar that shows "Disconnected" (red, persistent) when offline and "Connected" (green, auto-hides after 4s) when reconnected.

**Architecture:** A single `'use client'` component (`NetworkStatusIndicator`) handles `navigator.onLine` on mount and listens to native `window` `online`/`offline` events. It is imported into the existing `AppHeader` server component and rendered between `<ThemeToggle />` and `<LogoutButton />`. No new dependencies required.

**Tech Stack:** Next.js 14 App Router, React hooks (`useState`, `useEffect`, `useRef`), Tailwind CSS design tokens, Lucide React icons (`Wifi`, `WifiOff`)

---

## File Map

| Action | Path                                             | Responsibility                                              |
| ------ | ------------------------------------------------ | ----------------------------------------------------------- |
| Create | `src/components/ui/network-status-indicator.tsx` | Client component — all connection state logic and rendering |
| Modify | `src/components/ui/app-header.tsx`               | Import and render `<NetworkStatusIndicator />`              |

---

### Task 1: Create `NetworkStatusIndicator` client component

**Files:**

- Create: `src/components/ui/network-status-indicator.tsx`

- [ ] **Step 1: Create the component file**

Create `src/components/ui/network-status-indicator.tsx` with the following content:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Wifi, WifiOff } from 'lucide-react'

type ConnectionStatus = 'offline' | 'reconnected' | 'hidden'

export function NetworkStatusIndicator() {
  const [status, setStatus] = useState<ConnectionStatus>('hidden')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!navigator.onLine) {
      setStatus('offline')
    }

    function handleOffline() {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setStatus('offline')
    }

    function handleOnline() {
      setStatus('reconnected')
      timerRef.current = setTimeout(() => {
        setStatus('hidden')
        timerRef.current = null
      }, 4000)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (status === 'hidden') return null

  const isOffline = status === 'offline'

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
```

- [ ] **Step 2: Verify the file looks correct**

Check that:

- The file starts with `'use client'`
- `status` starts as `'hidden'` (no flash on initial load for online users)
- `handleOffline` clears any pending timer before setting offline (prevents stale "Connected" pills)
- `handleOnline` starts a 4000ms timer that sets status back to `'hidden'`
- Cleanup function removes both event listeners and clears the timer
- `navigator.onLine` is checked on mount so users who load the page while offline see the pill immediately

---

### Task 2: Wire `NetworkStatusIndicator` into `AppHeader`

**Files:**

- Modify: `src/components/ui/app-header.tsx`

- [ ] **Step 1: Add the import**

In `src/components/ui/app-header.tsx`, add the import after the existing `ThemeToggle` import:

```tsx
import { NetworkStatusIndicator } from '@/components/ui/network-status-indicator'
```

The import block should look like:

```tsx
import { LogoutButton } from '@/features/auth/components/logout-button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { AppNavLinks } from '@/components/ui/app-nav-links'
import { NetworkStatusIndicator } from '@/components/ui/network-status-indicator'
import { createSupabaseServerClient } from '@/lib/supabase/server'
```

- [ ] **Step 2: Render the component between ThemeToggle and LogoutButton**

Find the right-side flex div in `app-header.tsx` (around line 75) and add `<NetworkStatusIndicator />` between `<ThemeToggle />` and `<LogoutButton />`:

```tsx
<div className="flex items-center gap-3">
  <Link
    href="/profile"
    aria-label="Open profile"
    title="Profile"
    className="hidden sm:flex items-center gap-3 rounded-xl px-3 py-1.5 transition-colors hover:bg-muted group"
  >
    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20">
      {initials}
    </div>
    <div className="text-right">
      <p className="text-sm font-semibold leading-tight text-foreground group-hover:text-foreground">
        {displayName}
      </p>
      <p className="text-xs text-muted-foreground leading-tight">
        {employee.designations?.designation_name ?? ''}
      </p>
    </div>
  </Link>
  <div className="hidden sm:block w-px h-6 bg-border" />
  <ThemeToggle />
  <NetworkStatusIndicator />
  <LogoutButton />
</div>
```

---

### Task 3: Manual Verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open `http://localhost:3000` and log in.

- [ ] **Step 2: Test offline state**

1. Open DevTools (F12) → **Network** tab → throttle dropdown → select **Offline**
2. Expected: red pill with `WifiOff` icon and "Disconnected" text appears in the navbar immediately
3. Pill must persist — it should not disappear on its own while offline

- [ ] **Step 3: Test reconnect state**

1. With the red pill showing, remove the **Offline** throttle (set back to No throttling)
2. Expected: pill immediately swaps to green with `Wifi` icon and "Connected" text
3. After exactly 4 seconds, the green pill disappears
4. Expected: navbar returns to its normal state with no pill

- [ ] **Step 4: Test offline-during-reconnect edge case**

1. Go offline (DevTools → Offline) → red pill appears
2. Go back online → green pill appears
3. Within 4 seconds, go offline again
4. Expected: green pill immediately swaps back to red pill (no lingering "Connected" state)

- [ ] **Step 5: Test offline on page load**

1. Set DevTools to **Offline**
2. Hard refresh the page (`Ctrl+Shift+R`)
3. Expected: red pill is visible immediately after the page loads (no flash of hidden state first)

- [ ] **Step 6: Check dark mode**

1. Toggle dark mode using the theme button
2. Expected: red pill uses `bg-error-light text-error` tokens — verify these look correct in dark theme (deep red background, red text)
3. Repeat the online/offline cycle in dark mode

- [ ] **Step 7: Check mobile viewport**

1. DevTools → toggle device toolbar → pick a mobile size (e.g. iPhone 12, 390px wide)
2. Go offline
3. Expected: pill fits within the header row without overflowing or wrapping

---

## Spec Coverage Check

| Spec requirement                            | Covered by                                                  |
| ------------------------------------------- | ----------------------------------------------------------- |
| Red pill "Disconnected" when offline        | Task 1 — `status === 'offline'` branch                      |
| Persists until reconnected                  | Task 1 — no timer on offline, only clears on `online` event |
| Green pill "Connected" when reconnected     | Task 1 — `status === 'reconnected'` branch                  |
| Auto-hides after 4 seconds                  | Task 1 — `setTimeout(4000)` in `handleOnline`               |
| Offline-during-reconnect clears timer       | Task 1 — `clearTimeout` in `handleOffline`                  |
| Placed between ThemeToggle and LogoutButton | Task 2                                                      |
| Uses existing color tokens (error/success)  | Task 1 — Tailwind classes                                   |
| `animate-fade-in` entry animation           | Task 1 — class on the span                                  |
| `role="status"` + `aria-live="polite"`      | Task 1 — attributes on span                                 |
| No new dependencies                         | Confirmed — only Lucide icons already in project            |
