// FIX [ISSUE#2] — Streaming chunked export utility to eliminate unbounded in-memory arrays
import { toCsvCell } from '@/lib/utils/csv'

/** Hard server-side cap to prevent memory exhaustion on large exports. */
export const MAX_EXPORT_ROWS = 50_000
const EXPORT_CHUNK_SIZE = 1000

type PaginatedFetcher<T> = (
  cursor: string | null,
  limit: number
) => Promise<{
  data: T[]
  hasNextPage: boolean
  nextCursor: string | null
}>

type CsvRowMapper<T> = (row: T) => string[]

type StreamingExportOptions<T> = {
  fetcher: PaginatedFetcher<T>
  headers: string[]
  mapRow: CsvRowMapper<T>
  filename: string
}

function toCsvLine(cells: string[]): string {
  return cells.map((cell) => toCsvCell(cell)).join(',')
}

export function createStreamingCsvResponse<T>({
  fetcher,
  headers,
  mapRow,
  filename,
}: StreamingExportOptions<T>): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Emit CSV header row
        controller.enqueue(encoder.encode(toCsvLine(headers) + '\n'))

        let cursor: string | null = null
        let totalFetched = 0

        do {
          const page = await fetcher(cursor, EXPORT_CHUNK_SIZE)

          totalFetched += page.data.length

          if (totalFetched > MAX_EXPORT_ROWS) {
            controller.error(
              new Error(
                `Export exceeds ${MAX_EXPORT_ROWS} rows. Apply filters to narrow results.`
              )
            )
            return
          }

          const chunk = page.data
            .map((row) => toCsvLine(mapRow(row)))
            .join('\n')

          if (chunk) {
            controller.enqueue(encoder.encode(chunk + '\n'))
          }

          cursor = page.hasNextPage ? page.nextCursor : null
        } while (cursor)

        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'Transfer-Encoding': 'chunked',
    },
  })
}

/**
 * Returns HTTP 413 when an export-all request would exceed the row cap.
 * Use as a guard before starting the stream if you can cheaply estimate count.
 */
export function exportTooLargeResponse(): Response {
  return new Response(
    `Export too large. Apply filters to narrow results. Maximum: ${MAX_EXPORT_ROWS} rows.`,
    { status: 413 }
  )
}
