type SearchParamValue = string | string[] | undefined

type QueryRecord = Record<string, SearchParamValue>

export function getFirstSearchParamValue(
  value: SearchParamValue
): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

export function createNonEmptySearchParams(
  query: QueryRecord | undefined
): URLSearchParams {
  const params = new URLSearchParams()

  if (!query) {
    return params
  }

  for (const [key, value] of Object.entries(query)) {
    const normalizedValue = getFirstSearchParamValue(value)
    if (!normalizedValue) {
      continue
    }

    params.set(key, normalizedValue)
  }

  return params
}

export function toSortedQueryString(params: URLSearchParams): string {
  const sortedEntries = [...params.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  )

  return new URLSearchParams(sortedEntries).toString()
}

export function buildPathWithSearchParams(
  pathname: string,
  params: URLSearchParams
): string {
  const queryString = params.toString()
  return queryString ? `${pathname}?${queryString}` : pathname
}
