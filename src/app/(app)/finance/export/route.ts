import { resolveFinanceHistoryExportContext } from '@/features/finance/server/finance-history-export-context'
import { getFinanceHistoryPageForExport } from '@/features/finance/data/queries'
import {
  FINANCE_HISTORY_CSV_HEADERS,
  mapFinanceHistoryToCsvRow,
} from '@/features/finance/utils/filters'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  buildDatedCsvFilename,
  createCsvExportErrorResponse,
  createExportRouteHandlers,
} from '@/lib/utils/export-route'
import { runCsvExport } from '@/lib/utils/run-csv-export'

async function handleExportRequest(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url)
    const requestId = url.searchParams.get('requestId')

    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const resolved = await resolveFinanceHistoryExportContext(
      supabase,
      user?.email ? { email: user.email } : null,
      url.searchParams
    )

    if (!resolved.ok) {
      return createCsvExportErrorResponse(resolved.message, resolved.status)
    }

    const { filters } = resolved.context
    const filename = buildDatedCsvFilename('approved-history')

    return runCsvExport(
      {
        fetchPage: (cursor, limit) =>
          getFinanceHistoryPageForExport(supabase, cursor, limit, filters),
        headers: FINANCE_HISTORY_CSV_HEADERS,
        mapRow: mapFinanceHistoryToCsvRow,
        filename,
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
