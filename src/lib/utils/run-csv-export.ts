import { toCsvCell } from '@/lib/utils/csv'
import {
  markExportDone,
  markExportError,
  updateExportProgress,
} from '@/lib/utils/export-progress-registry'

/** Hard server-side cap to prevent memory exhaustion on large exports. */
export const MAX_EXPORT_ROWS = 50_000
// Same chunk-size rationale as the retired streaming-export.ts: db-max-rows
// (confirmed 1000 on dev/prod) minus 1 for the page RPC's internal p_limit+1
// probe row. 500 gives 2x margin below that ceiling.
export const EXPORT_CHUNK_SIZE = 500

type CsvExportPage<T> = {
  data: T[]
  hasNextPage: boolean
  nextCursor: string | null
}

type CsvExportFetcher<T> = (
  cursor: string | null,
  limit: number
) => Promise<CsvExportPage<T>>

type CsvRowMapper<T> = (row: T) => string[]

export type CsvExportRecipe<T> = {
  fetchPage: CsvExportFetcher<T>
  headers: string[]
  mapRow: CsvRowMapper<T>
  filename: string
}

function toCsvLine(cells: string[]): string {
  return cells.map((cell) => toCsvCell(cell)).join(',')
}

/**
 * requestId is null when a route is hit directly without going through
 * POST /api/exports/start (e.g. a bookmarked URL) — the export still runs,
 * just without progress-registry side effects.
 */
export function runCsvExport<T>(
  recipe: CsvExportRecipe<T>,
  requestId: string | null
): Response {
  const { fetchPage, headers, mapRow, filename } = recipe
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(toCsvLine(headers) + '\n'))

        let cursor: string | null = null
        let totalFetched = 0

        do {
          const page = await fetchPage(cursor, EXPORT_CHUNK_SIZE)

          totalFetched += page.data.length

          if (totalFetched > MAX_EXPORT_ROWS) {
            const message = `Export exceeds ${MAX_EXPORT_ROWS} rows. Apply filters to narrow results.`

            if (requestId) {
              markExportError(requestId, message)
            }

            controller.error(new Error(message))
            return
          }

          const chunk = page.data
            .map((row) => toCsvLine(mapRow(row)))
            .join('\n')

          if (chunk) {
            controller.enqueue(encoder.encode(chunk + '\n'))
          }

          if (requestId) {
            updateExportProgress(requestId, totalFetched)
          }

          cursor = page.hasNextPage ? page.nextCursor : null
        } while (cursor)

        if (requestId) {
          markExportDone(requestId)
        }

        controller.close()
      } catch (error) {
        if (requestId) {
          markExportError(
            requestId,
            error instanceof Error ? error.message : 'Export failed.'
          )
        }

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

export function exportTooLargeResponse(): Response {
  return new Response(
    `Export too large. Apply filters to narrow results. Maximum: ${MAX_EXPORT_ROWS} rows.`,
    { status: 413 }
  )
}
