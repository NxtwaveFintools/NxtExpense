type CursorPayload = {
  created_at: string
  id: string
}

type QueryValue = string | string[] | undefined

type QueryRecord = Record<string, QueryValue>

const NULL_CURSOR_MARKER = '__NULL_CURSOR__'

export type PaginatedResult<T> = {
  data: T[]
  nextCursor: string | null
  hasNextPage: boolean
  limit: number
}

function normalizePositiveInteger(value: number, fallback = 1): number {
  if (!Number.isFinite(value)) {
    return fallback
  }

  const normalized = Math.trunc(value)
  return normalized > 0 ? normalized : fallback
}

export function getCursorTotalPages(
  totalItems: number,
  pageSize: number
): number {
  const normalizedTotalItems = Math.max(0, Math.trunc(totalItems))
  const normalizedPageSize = normalizePositiveInteger(pageSize)

  if (normalizedTotalItems === 0) {
    return 1
  }

  return Math.ceil(normalizedTotalItems / normalizedPageSize)
}

export function getCursorPageStartIndex(
  pageNumber: number,
  pageSize: number
): number {
  const normalizedPageNumber = normalizePositiveInteger(pageNumber)
  const normalizedPageSize = normalizePositiveInteger(pageSize)

  return (normalizedPageNumber - 1) * normalizedPageSize + 1
}

export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload)
  return Buffer.from(json, 'utf-8').toString('base64')
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8')
    const parsed = JSON.parse(decoded) as CursorPayload

    if (!parsed?.created_at || !parsed?.id) {
      throw new Error('Invalid cursor payload.')
    }

    return parsed
  } catch {
    throw new Error('Invalid cursor.')
  }
}

export function encodeCursorTrail(trail: Array<string | null>): string {
  const serializedTrail = trail.map((entry) => entry ?? NULL_CURSOR_MARKER)
  return Buffer.from(JSON.stringify(serializedTrail), 'utf-8').toString(
    'base64'
  )
}

export function decodeCursorTrail(
  encodedTrail: string | null | undefined
): Array<string | null> {
  if (!encodedTrail) {
    return []
  }

  try {
    const decoded = Buffer.from(encodedTrail, 'base64').toString('utf-8')
    const parsed = JSON.parse(decoded)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.map((entry) => {
      if (typeof entry !== 'string') {
        return null
      }

      if (entry === NULL_CURSOR_MARKER) {
        return null
      }

      return entry
    })
  } catch {
    return []
  }
}

function getFirstQueryValue(value: QueryValue): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

function createBaseSearchParams(
  query: QueryRecord | undefined,
  excludedKeys: string[]
): URLSearchParams {
  const params = new URLSearchParams()

  if (!query) {
    return params
  }

  for (const [key, value] of Object.entries(query)) {
    if (excludedKeys.includes(key)) {
      continue
    }

    const normalized = getFirstQueryValue(value)
    if (normalized) {
      params.set(key, normalized)
    }
  }

  return params
}

function buildHref(pathname: string, params: URLSearchParams): string {
  const queryString = params.toString()
  return queryString ? `${pathname}?${queryString}` : pathname
}

type CursorNavigationLinks = {
  backHref: string | null
  nextHref: string | null
  pageNumber: number
}

type BuildCursorNavigationLinksInput = {
  pathname: string
  query: QueryRecord | undefined
  cursorKey: string
  trailKey: string
  currentCursor: string | null
  currentTrail: Array<string | null>
  nextCursor: string | null
}

export function buildCursorNavigationLinks(
  input: BuildCursorNavigationLinksInput
): CursorNavigationLinks {
  const {
    pathname,
    query,
    cursorKey,
    trailKey,
    currentCursor,
    currentTrail,
    nextCursor,
  } = input

  const baseParams = createBaseSearchParams(query, [cursorKey, trailKey])

  const createNavigationHref = (
    targetCursor: string | null,
    targetTrail: Array<string | null>
  ) => {
    const params = new URLSearchParams(baseParams.toString())

    if (targetCursor) {
      params.set(cursorKey, targetCursor)
    } else {
      params.delete(cursorKey)
    }

    if (targetTrail.length > 0) {
      params.set(trailKey, encodeCursorTrail(targetTrail))
    } else {
      params.delete(trailKey)
    }

    return buildHref(pathname, params)
  }

  const pageNumber = currentTrail.length + 1
  const previousCursor =
    currentTrail.length > 0 ? currentTrail[currentTrail.length - 1] : null
  const previousTrail = currentTrail.length > 0 ? currentTrail.slice(0, -1) : []

  return {
    backHref:
      currentTrail.length > 0
        ? createNavigationHref(previousCursor, previousTrail)
        : null,
    nextHref: nextCursor
      ? createNavigationHref(nextCursor, [...currentTrail, currentCursor])
      : null,
    pageNumber,
  }
}
