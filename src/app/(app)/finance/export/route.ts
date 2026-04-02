import { getEmployeeByEmail } from '@/lib/services/employee-service'
import { isFinanceTeamMember } from '@/features/finance/permissions'
import {
  getAllFilteredFinanceHistory,
  getFinanceHistoryPaginated,
} from '@/features/finance/queries'
import {
  buildFinanceHistoryCsv,
  normalizeFinanceFilters,
} from '@/features/finance/utils/filters'
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

    const filters = normalizeFinanceFilters({
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

    const rows =
      mode === 'all'
        ? await getAllFilteredFinanceHistory(supabase, effectiveFilters)
        : (
            await getFinanceHistoryPaginated(
              supabase,
              historyCursor,
              PAGE_EXPORT_LIMIT,
              effectiveFilters
            )
          ).data

    const csv = buildFinanceHistoryCsv(rows)
    const dateStamp = new Date().toISOString().slice(0, 10)
    const filename = `approved-history-${mode}-${dateStamp}.csv`

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
