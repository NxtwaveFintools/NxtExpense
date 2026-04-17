import { getEmployeeByEmail } from '@/lib/services/employee-service'
import { isFinanceTeamMember } from '@/features/finance/permissions'
import { getFinanceQueuePaginated } from '@/features/finance/queries'
import type { FinanceDateFilterField } from '@/features/finance/types'
import {
  buildFinancePendingClaimsCsv,
  FINANCE_PENDING_CLAIMS_CSV_HEADERS,
  mapFinancePendingClaimToCsvRow,
  normalizeFinanceFilters,
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
import { createStreamingCsvResponse } from '@/lib/utils/streaming-export'

const PENDING_CLAIMS_DATE_FILTER_OPTIONS: FinanceDateFilterField[] = [
  'claim_date',
  'submitted_at',
  'hod_approved_date',
]

const PENDING_CLAIMS_DATE_FILTER_OPTION_SET = new Set(
  PENDING_CLAIMS_DATE_FILTER_OPTIONS
)

function getPendingClaimsExportFilters(searchParams: URLSearchParams) {
  const normalizedFilters = normalizeFinanceFilters({
    employeeName: searchParams.get('employeeName') ?? undefined,
    claimNumber: searchParams.get('claimNumber') ?? undefined,
    ownerDesignation: searchParams.get('ownerDesignation') ?? undefined,
    claimStatus: searchParams.get('claimStatus') ?? undefined,
    workLocation: searchParams.get('workLocation') ?? undefined,
    dateFilterField: searchParams.get('dateFilterField') ?? undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
  })

  return {
    ...normalizedFilters,
    // Pending claims page does not use these filters.
    hodApproverEmployeeId: null,
    claimStatus: null,
    actionFilter: null,
    dateFilterField: PENDING_CLAIMS_DATE_FILTER_OPTION_SET.has(
      normalizedFilters.dateFilterField
    )
      ? normalizedFilters.dateFilterField
      : 'claim_date',
  }
}

async function handleExportRequest(request: Request) {
  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams

    const mode = getExportMode(searchParams.get('mode'))
    const queueCursor = searchParams.get('queueCursor')
    const pageSize = normalizeCursorPageSize(searchParams.get('pageSize'))
    const filters = getPendingClaimsExportFilters(searchParams)

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
    const filename = buildDatedCsvFilename('pending-claims', mode)

    if (mode === 'all') {
      return createStreamingCsvResponse({
        fetcher: (cursor, limit) =>
          getFinanceQueuePaginated(supabase, cursor, limit, filters),
        headers: FINANCE_PENDING_CLAIMS_CSV_HEADERS,
        mapRow: mapFinancePendingClaimToCsvRow,
        filename,
      })
    }

    const rows = (
      await getFinanceQueuePaginated(supabase, queueCursor, pageSize, filters)
    ).data
    const csv = buildFinancePendingClaimsCsv(rows)

    return createCsvResponse(csv, filename)
  } catch (error) {
    return createCsvErrorResponse(error)
  }
}

export const { GET, POST } = createExportRouteHandlers(handleExportRequest)
