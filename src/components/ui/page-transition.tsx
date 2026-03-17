'use client'

import { usePathname } from 'next/navigation'

/**
 * Wraps page children with a buttery smooth entrance animation
 * on every route change. Uses a key-based remount to trigger
 * the CSS `animate-page-enter` animation.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div key={pathname} className="animate-page-enter">
      {children}
    </div>
  )
}
