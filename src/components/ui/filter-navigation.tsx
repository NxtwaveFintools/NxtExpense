'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useTransition,
} from 'react'
import { useRouter } from 'next/navigation'

type FilterNavigationContextValue = {
  isPending: boolean
  navigate: (href: string) => void
}

const FilterNavigationContext =
  createContext<FilterNavigationContextValue | null>(null)

/**
 * Wraps a page's content region so filter changes can navigate inside a
 * transition. While the transition is pending, consumers can render skeletons
 * over the results without blocking the filter inputs.
 */
export function FilterNavigationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const navigate = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href)
      })
    },
    [router]
  )

  const value = useMemo(() => ({ isPending, navigate }), [isPending, navigate])

  return (
    <FilterNavigationContext.Provider value={value}>
      {children}
    </FilterNavigationContext.Provider>
  )
}

export function useFilterNavigation(): FilterNavigationContextValue {
  const context = useContext(FilterNavigationContext)

  if (!context) {
    throw new Error(
      'useFilterNavigation must be used within a FilterNavigationProvider'
    )
  }

  return context
}
