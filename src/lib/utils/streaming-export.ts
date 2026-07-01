// FIX [ISSUE#2] — Streaming chunked export utility to eliminate unbounded in-memory arrays
import { toCsvCell } from '@/lib/utils/csv'

/** Hard server-side cap to prevent memory exhaustion on large exports. */
export const MAX_EXPORT_ROWS = 50_000
// Post Phase-6 rewrite (docs/superpowers/plans/2026-07-01-finance-history-single-rpc-hydration.md),
// get_finance_history_page returns fully-hydrated rows directly — no follow-up
// .in('id', [...ids]) call, so the old URL-length ceiling (~350-400 ids) no longer
// applies. The new ceiling is `db-max-rows` (confirmed 1000 on both dev and prod as of
// 2026-07-01) — but note the RPC internally requests `p_limit + 1` rows for its own
// hasNextPage probe, so the TRUE safe ceiling is db-max-rows - 1 = 999, not 1000: a
// chunk size of exactly 1000 would make PostgREST silently truncate the 1001-row
// request back to 1000, making `hasNextPage` (`length > limit`) false when a next page
// actually exists — the same silent-truncation failure mode as the original bug, via a
// different mechanism. 500 gives 2x margin below that ceiling. Real measured payload:
// ~2.25KB/row, so 500 rows ≈ 1.1MB per call — trivial, not the binding constraint.
export const EXPORT_CHUNK_SIZE = 500

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
