import { QueryClient } from '@tanstack/react-query'

import { QUERY_GC_TIME } from '@/lib/constants/query-config'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: QUERY_GC_TIME.MEDIUM,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

export function getQueryClient() {
  if (typeof window === 'undefined') {
    return createQueryClient()
  }

  if (!browserQueryClient) {
    browserQueryClient = createQueryClient()
  }

  return browserQueryClient
}
