# Network Status Indicator — Design Spec

**Date:** 2026-05-22
**Status:** Approved

## Overview

Add a real-time internet connection status indicator to the app navbar. When the user loses connectivity, a persistent red pill badge appears. When reconnected, it swaps to a green pill that auto-dismisses after 4 seconds.

## Architecture

A single new `'use client'` component — `NetworkStatusIndicator` — is imported into the existing `AppHeader` server component. This keeps `AppHeader` as a server component; only the indicator runs client-side.

**Files changed:**

| File                                             | Change                                       |
| ------------------------------------------------ | -------------------------------------------- |
| `src/components/ui/network-status-indicator.tsx` | New client component                         |
| `src/components/ui/app-header.tsx`               | Import + render `<NetworkStatusIndicator />` |

No new dependencies. Uses `navigator.onLine`, native DOM events, existing Tailwind design tokens, and Lucide icons already in the project.

## Component: `NetworkStatusIndicator`

### Placement

Inserted into the right-side `flex items-center gap-3` div of `AppHeader`, between `<ThemeToggle />` and `<LogoutButton />`. This keeps `LogoutButton` as the rightmost (conventional danger-zone) element.

### State Machine

```
initial (online, hidden)
  │
  ├── offline event ──► OFFLINE (red pill, persistent)
  │                        │
  │                        └── online event ──► RECONNECTED (green pill, 4s timer)
  │                                                │
  │                                                ├── timer fires ──► hidden
  │                                                └── offline event ──► OFFLINE (timer cancelled)
  └── offline event (on mount if navigator.onLine === false) ──► OFFLINE
```

### Behaviour

- **Mount:** reads `navigator.onLine`. If `false`, immediately shows the offline pill. If `true`, renders nothing.
- **`offline` event:** shows red pill, clears any pending reconnect timer.
- **`online` event:** swaps to green pill, starts a 4-second `setTimeout`. After 4s, hides the pill.
- **Unmount:** removes event listeners and clears any pending timer.

### Visual Design

```
Offline:     [ WifiOff  Disconnected ]   ← red pill, persists
Reconnected: [ Wifi     Connected    ]   ← green pill, fades after 4s
Hidden:      (nothing rendered)
```

**Pill classes:**

- Base: `inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border shadow-xs animate-fade-in`
- Offline: `bg-error-light text-error border-error/20`
- Reconnected: `bg-success-light text-success border-success/20`

**Icons (Lucide):**

- Offline: `WifiOff` at `size-3.5`
- Reconnected: `Wifi` at `size-3.5`

**Animation:**

- Entry: `animate-fade-in` (already defined in `animations.css` — 0.4s ease-spring)
- Exit: component unmounts cleanly (no lingering DOM element)

## Error Handling

- `navigator.onLine` is not 100% accurate (can report online when actually offline behind a captive portal), but it is the standard browser API and correct for the vast majority of real disconnection scenarios.
- The component is purely presentational — it never blocks user actions or navigation.

## Accessibility

- The pill has `role="status"` and `aria-live="polite"` so screen readers announce the connection change without interrupting the user.
- Icon is `aria-hidden="true"`; the text label carries the meaning.

## Testing

Manual testing checklist:

1. Open DevTools → Network → set "Offline" → red pill appears immediately
2. Remove "Offline" → green pill appears, disappears after 4 seconds
3. Go offline again during the 4s green window → green pill swaps to red immediately
4. Refresh while offline → red pill shows on mount
5. Check dark mode — colors match theme
6. Check mobile viewport — pill fits within the header
