import { getEmployeeByEmail } from '@/lib/services/employee-service'
import { isFinanceTeamMember } from '@/features/finance/permissions'
import { getFinanceHistoryPaginated } from '@/features/finance/queries'
import {
  buildFinanceHistoryCsv,
  normalizeFinanceFilters,
  FINANCE_HISTORY_CSV_HEADERS,
  mapFinanceHistoryToCsvRow,
} from '@/features/finance/utils/filters'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  buildDatedCsvFilename,
  createCsvErrorResponse,
  createCsvResponse,
  createExportRouteHandlers,
  getExportMode,
} from '@/lib/utils/export-route'
import { normalizeCursorPageSize } from '@/lib/utils/pagination'
// FIX [ISSUE#2] — Streaming chunked export to eliminate unbounded in-memory arrays
import { createStreamingCsvResponse } from '@/lib/utils/streaming-export'

async function handleExportRequest(request: Request) {
  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams

    const mode = getExportMode(searchParams.get('mode'))
    const historyCursor = searchParams.get('historyCursor')
    const pageSize = normalizeCursorPageSize(searchParams.get('pageSize'))

    const filters = normalizeFinanceFilters({
      employeeId: searchParams.get('employeeId') ?? undefined,
      employeeName: searchParams.get('employeeName') ?? undefined,
      claimNumber: searchParams.get('claimNumber') ?? undefined,
      ownerDesignation: searchParams.get('ownerDesignation') ?? undefined,
      hodApproverEmployeeId:
        searchParams.get('hodApproverEmployeeId') ?? undefined,
      workLocation: searchParams.get('workLocation') ?? undefined,
      actionFilter: searchParams.get('actionFilter') ?? undefined,
      dateFilterField: searchParams.get('dateFilterField') ?? undefined,
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
    })

    const effectiveFilters = {
      ...filters,
      claimStatus: null,
    }

    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      return new Response('Unauthorized request.', { status: 401 })
    }

    const employee = await getEmployeeByEmail(supabase, user.email)
    if (!employee || !(await isFinanceTeamMember(supabase, employee))) {
      return new Response('Finance access is required.', { status: 403 })
    }

    const filename = buildDatedCsvFilename('approved-history', mode)

    // FIX [ISSUE#2] — Stream export-all instead of holding full dataset in memory
    if (mode === 'all') {
      return createStreamingCsvResponse({
        fetcher: (cursor, limit) =>
          getFinanceHistoryPaginated(supabase, cursor, limit, effectiveFilters),
        headers: FINANCE_HISTORY_CSV_HEADERS,
        mapRow: mapFinanceHistoryToCsvRow,
        filename,
      })
    }

    const paginated = await getFinanceHistoryPaginated(
      supabase,
      historyCursor,
      pageSize,
      effectiveFilters
    )
    const csv = buildFinanceHistoryCsv(paginated.data)

    return createCsvResponse(csv, filename)
  } catch (error) {
    return createCsvErrorResponse(error)
  }
}

export const { GET, POST } = createExportRouteHandlers(handleExportRequest)
