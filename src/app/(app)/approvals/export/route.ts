import { canAccessApprovals } from '@/features/employees/permissions'
import {
  getEmployeeByEmail,
  hasApproverAssignments,
} from '@/lib/services/employee-service'
import {
  getAllFilteredApprovalHistory,
  getFilteredApprovalHistoryPaginated,
} from '@/features/approvals/queries/history-filters'
import {
  buildApprovalHistoryCsv,
  normalizeApprovalHistoryFilters,
} from '@/features/approvals/utils/history-filters'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const PAGE_EXPORT_LIMIT = 10

type ExportMode = 'page' | 'all'

function getExportMode(value: string | null): ExportMode {
  return value === 'all' ? 'all' : 'page'
}

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

    const rows =
      mode === 'all'
        ? await getAllFilteredApprovalHistory(supabase, filters)
        : (
            await getFilteredApprovalHistoryPaginated(
              supabase,
              historyCursor,
              PAGE_EXPORT_LIMIT,
              filters
            )
          ).data

    const csv = buildApprovalHistoryCsv(rows)
    const dateStamp = new Date().toISOString().slice(0, 10)
    const filename = `approvals-history-${mode}-${dateStamp}.csv`

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : 'Failed to export CSV.',
      { status: 400 }
    )
  }
}

export async function GET(request: Request) {
  return handleExportRequest(request)
}

export async function POST(request: Request) {
  return handleExportRequest(request)
}
