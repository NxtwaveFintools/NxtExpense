'use client'

import { useFilterNavigation } from '@/components/ui/filter-navigation'

/**
 * Renders `children`, swapping in `skeleton` while a filter navigation is in
 * flight, so only the results region shows the loading state.
 */
export function PendingResults({
  skeleton,
  children,
}: {
  skeleton: React.ReactNode
  children: React.ReactNode
}) {
  const { isPending } = useFilterNavigation()

  return <>{isPending ? skeleton : children}</>
}
