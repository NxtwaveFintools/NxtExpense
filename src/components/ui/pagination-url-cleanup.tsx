'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

type PaginationUrlCleanupProps = {
  keys: string[]
}

function PaginationUrlCleanupInner({ keys }: PaginationUrlCleanupProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    let hasChanges = false

    for (const key of keys) {
      if (params.has(key)) {
        params.delete(key)
        hasChanges = true
      }
    }

    if (!hasChanges) {
      return
    }

    const queryString = params.toString()
    const nextUrl = `${pathname}${queryString ? `?${queryString}` : ''}${window.location.hash}`
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`

    if (currentUrl !== nextUrl) {
      window.history.replaceState(window.history.state, '', nextUrl)
    }
  }, [keys, pathname, searchParams])

  return null
}

export function PaginationUrlCleanup({ keys }: PaginationUrlCleanupProps) {
  return (
    <Suspense>
      <PaginationUrlCleanupInner keys={keys} />
    </Suspense>
  )
}
