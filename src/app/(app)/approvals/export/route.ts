import { canAccessApprovals } from '@/features/employees/permissions'
import {
  getEmployeeByEmail,
  hasApproverAssignments,
} from '@/lib/services/employee-service'
import { getFilteredApprovalHistoryPaginated } from '@/features/approvals/queries/history-filters'
import {
  buildApprovalHistoryCsv,
  normalizeApprovalHistoryFilters,
  APPROVAL_HISTORY_CSV_HEADERS,
  mapApprovalHistoryToCsvRow,
} from '@/features/approvals/utils/history-filters'
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
    const historyCursor = searchParams.get('historyCursor')

    const filters = normalizeApprovalHistoryFilters({
      claimStatus: searchParams.get('claimStatus') ?? undefined,
      employeeName: searchParams.get('employeeName') ?? undefined,
      claimDateFrom: searchParams.get('claimDateFrom') ?? undefined,
      claimDateTo: searchParams.get('claimDateTo') ?? undefined,
      amountOperator: searchParams.get('amountOperator') ?? undefined,
      amountValue: searchParams.get('amountValue') ?? undefined,
      locationType: searchParams.get('locationType') ?? undefined,
      claimDateSort: searchParams.get('claimDateSort') ?? undefined,
      hodApprovedFrom: searchParams.get('hodApprovedFrom') ?? undefined,
      hodApprovedTo: searchParams.get('hodApprovedTo') ?? undefined,
      financeApprovedFrom: searchParams.get('financeApprovedFrom') ?? undefined,
      financeApprovedTo: searchParams.get('financeApprovedTo') ?? undefined,
    })

    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      return new Response('Unauthorized request.', { status: 401 })
    }

    const employee = await getEmployeeByEmail(supabase, user.email)
    if (!employee) {
      return new Response('Approver profile not found.', { status: 403 })
    }

    const approverAccess = await hasApproverAssignments(
      supabase,
      employee.employee_email
    )
    if (!canAccessApprovals(approverAccess)) {
      return new Response('Access denied.', { status: 403 })
    }

    const filename = buildDatedCsvFilename('approvals-history', mode)

    // FIX [ISSUE#2] — Stream export-all instead of holding full dataset in memory
    if (mode === 'all') {
      return createStreamingCsvResponse({
        fetcher: (cursor, limit) =>
          getFilteredApprovalHistoryPaginated(supabase, cursor, limit, filters),
        headers: APPROVAL_HISTORY_CSV_HEADERS,
        mapRow: mapApprovalHistoryToCsvRow,
        filename,
      })
    }

    const paginated = await getFilteredApprovalHistoryPaginated(
      supabase,
      historyCursor,
      PAGE_EXPORT_LIMIT,
      filters
    )
    const csv = buildApprovalHistoryCsv(paginated.data)

    return createCsvResponse(csv, filename)
  } catch (error) {
    return createCsvErrorResponse(error)
  }
}

export const { GET, POST } = createExportRouteHandlers(handleExportRequest)
