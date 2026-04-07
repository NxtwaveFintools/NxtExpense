import { canAccessEmployeeClaims } from '@/features/employees/permissions'
import { getEmployeeByEmail } from '@/lib/services/employee-service'
import { getMyClaimsPaginated } from '@/features/claims/queries'
import {
  buildMyClaimsCsv,
  normalizeMyClaimsFilters,
  MY_CLAIMS_CSV_HEADERS,
  mapMyClaimToCsvRow,
} from '@/features/claims/utils/filters'
import { canDownloadClaimsCsv } from '@/features/claims/utils/export-permissions'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  buildDatedCsvFilename,
  createCsvErrorResponse,
  createCsvResponse,
  createExportRouteHandlers,
  getExportMode,
} from '@/lib/utils/export-route'
// FIX [ISSUE#2] — Streaming chunked export to eliminate unbounded in-memory arrays
import { createStreamingCsvResponse } from '@/lib/utils/streaming-export'

const PAGE_EXPORT_LIMIT = 10

async function handleExportRequest(request: Request) {
  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams

    const mode = getExportMode(searchParams.get('mode'))
    const cursor = searchParams.get('cursor')
    const filters = normalizeMyClaimsFilters({
      claimStatus: searchParams.get('claimStatus') ?? undefined,
      workLocation: searchParams.get('workLocation') ?? undefined,
      claimDateFrom: searchParams.get('claimDateFrom') ?? undefined,
      claimDateTo: searchParams.get('claimDateTo') ?? undefined,
    })

    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      return new Response('Unauthorized request.', { status: 401 })
    }

    const employee = await getEmployeeByEmail(supabase, user.email)
    if (!employee || !(await canAccessEmployeeClaims(supabase, employee))) {
      return new Response('Claims access is required.', { status: 403 })
    }

    if (!canDownloadClaimsCsv(employee.designations?.designation_name)) {
      return new Response('CSV export is not available for your designation.', {
        status: 403,
      })
    }

    const filename = buildDatedCsvFilename('my-claims', mode)

    // FIX [ISSUE#2] — Stream export-all instead of holding full dataset in memory
    if (mode === 'all') {
      return createStreamingCsvResponse({
        fetcher: (cur, limit) =>
          getMyClaimsPaginated(supabase, employee.id, cur, limit, filters),
        headers: MY_CLAIMS_CSV_HEADERS,
        mapRow: mapMyClaimToCsvRow,
        filename,
      })
    }

    const paginated = await getMyClaimsPaginated(
      supabase,
      employee.id,
      cursor,
      PAGE_EXPORT_LIMIT,
      filters
    )
    const csv = buildMyClaimsCsv(paginated.data)

    return createCsvResponse(csv, filename)
  } catch (error) {
    return createCsvErrorResponse(error)
  }
}

export const { GET, POST } = createExportRouteHandlers(handleExportRequest)
