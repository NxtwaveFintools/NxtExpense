import { resolveFinancePendingExportContext } from '@/features/finance/server/finance-pending-export-context'
import { getFinanceQueuePaginated } from '@/features/finance/data/queries'
import {
  FINANCE_PENDING_CLAIMS_CSV_HEADERS,
  mapFinancePendingClaimToCsvRow,
} from '@/features/finance/utils/filters'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  buildDatedCsvFilename,
  createCsvExportErrorResponse,
  createExportRouteHandlers,
} from '@/lib/utils/export-route'
import {
  ENRICHMENT_EXPORT_CHUNK_SIZE,
  runCsvExport,
} from '@/lib/utils/run-csv-export'

async function handleExportRequest(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url)

    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const resolved = await resolveFinancePendingExportContext(
      supabase,
      user?.email ? { email: user.email } : null,
      url.searchParams
    )

    if (!resolved.ok) {
      return createCsvExportErrorResponse(resolved.message, resolved.status)
    }

    const { filters } = resolved.context
    const filename = buildDatedCsvFilename('pending-claims')

    return runCsvExport({
      fetchPage: (cursor, limit) =>
        getFinanceQueuePaginated(supabase, cursor, limit, filters),
      headers: FINANCE_PENDING_CLAIMS_CSV_HEADERS,
      mapRow: mapFinancePendingClaimToCsvRow,
      filename,
      chunkSize: ENRICHMENT_EXPORT_CHUNK_SIZE,
    })
  } catch (error) {
    return createCsvExportErrorResponse(
      error instanceof Error ? error.message : 'Failed to export CSV.',
      400
    )
  }
}

export const { GET, POST } = createExportRouteHandlers(handleExportRequest)
