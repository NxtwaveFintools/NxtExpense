import { resolveMyClaimsExportContext } from '@/features/claims/server/claims-export-context'
import { getMyClaimsPaginated } from '@/features/claims/data/queries'
import {
  MY_CLAIMS_CSV_HEADERS,
  mapMyClaimToCsvRow,
} from '@/features/claims/utils/filters'
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

    const resolved = await resolveMyClaimsExportContext(
      supabase,
      user?.email ? { email: user.email } : null,
      url.searchParams
    )

    if (!resolved.ok) {
      return createCsvExportErrorResponse(resolved.message, resolved.status)
    }

    const { employee, filters } = resolved.context
    const filename = buildDatedCsvFilename('my-claims')

    return runCsvExport(
      {
        fetchPage: (cursor, limit) =>
          getMyClaimsPaginated(supabase, employee.id, cursor, limit, filters),
        headers: MY_CLAIMS_CSV_HEADERS,
        mapRow: mapMyClaimToCsvRow,
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
