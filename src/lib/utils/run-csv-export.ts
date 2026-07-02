import { toCsvCell } from '@/lib/utils/csv'
import {
  markExportDone,
  markExportError,
  updateExportProgress,
} from '@/lib/utils/export-progress-registry'

// Same chunk-size rationale as the retired streaming-export.ts: db-max-rows
// (confirmed 1000 on dev/prod) minus 1 for the page RPC's internal p_limit+1
// probe row. 800 stays under that 1000 ceiling (801 fetched per page) while
// cutting round-trips vs the previous 500 — live-verified against
// get_finance_history_page on 2026-07-02, no truncation.
//
// Only safe for routes whose repository fully hydrates each page inside the
// RPC (finance/export, claims/export, bc-expense-export). Routes whose
// repository does a follow-up `.in('id', pageIds)` REST enrichment read
// (finance/pending-export, approvals/export) must pass the smaller
// ENRICHMENT_EXPORT_CHUNK_SIZE below instead — see its comment for why.
export const EXPORT_CHUNK_SIZE = 800

// For export routes whose repository fetches a page of ids via RPC, then
// enriches them with a follow-up `.in('id', pageIds)` REST read (see
// src/features/finance/data/README.md's "Bounded enrichment" step —
// getFinanceQueuePaginated, getApprovalHistoryClaimEnrichmentByClaimId).
// That REST call puts every id directly in the URL query string, which the
// Supabase gateway rejects above roughly 25-27KB with a bare 400. Live-
// verified 2026-07-02 against the largest embed in this app (CLAIM_COLUMNS +
// owner join): 650 ids succeeds, 700 fails. 500 matches the old global
// EXPORT_CHUNK_SIZE (already proven safe in production) and keeps a real
// margin below that cliff. Do NOT raise this without re-verifying live —
// the ceiling is a raw URL-byte limit, not a fixed id count, so it shifts
// with whichever columns the query selects.
export const ENRICHMENT_EXPORT_CHUNK_SIZE = 500

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
  // Defaults to EXPORT_CHUNK_SIZE. Pass ENRICHMENT_EXPORT_CHUNK_SIZE for
  // routes that do a follow-up `.in('id', ...)` enrichment read.
  chunkSize?: number
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
  const {
    fetchPage,
    headers,
    mapRow,
    filename,
    chunkSize = EXPORT_CHUNK_SIZE,
  } = recipe
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(toCsvLine(headers) + '\n'))

        let cursor: string | null = null
        let totalFetched = 0

        do {
          const page = await fetchPage(cursor, chunkSize)

          totalFetched += page.data.length

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
