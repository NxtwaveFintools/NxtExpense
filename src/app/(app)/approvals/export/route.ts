import { resolveApprovalHistoryExportContext } from '@/features/approvals/server/approval-history-export-context'
import { getFilteredApprovalHistoryPaginated } from '@/features/approvals/data/queries'
import {
  APPROVAL_HISTORY_CSV_HEADERS,
  mapApprovalHistoryToCsvRow,
} from '@/features/approvals/utils/history-filters'
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
    const requestId = url.searchParams.get('requestId')

    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const resolved = await resolveApprovalHistoryExportContext(
      supabase,
      user?.email ? { email: user.email } : null,
      url.searchParams
    )

    if (!resolved.ok) {
      return createCsvExportErrorResponse(resolved.message, resolved.status)
    }

    const { filters } = resolved.context
    const filename = buildDatedCsvFilename('approvals-history')

    return runCsvExport(
      {
        fetchPage: (cursor, limit) =>
          getFilteredApprovalHistoryPaginated(supabase, cursor, limit, filters),
        headers: APPROVAL_HISTORY_CSV_HEADERS,
        mapRow: mapApprovalHistoryToCsvRow,
        filename,
        chunkSize: ENRICHMENT_EXPORT_CHUNK_SIZE,
      },
      requestId
    )
  } catch (error) {
    return createCsvExportErrorResponse(
      error instanceof Error ? error.message : 'Failed to export CSV.',
      400
    )
  }
}

export const { GET, POST } = createExportRouteHandlers(handleExportRequest)
