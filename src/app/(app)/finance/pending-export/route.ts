import { getEmployeeByEmail } from '@/lib/services/employee-service'
import { isFinanceTeamMember } from '@/features/finance/permissions'
import { getFinanceQueuePaginated } from '@/features/finance/queries'
import type { FinanceDateFilterField } from '@/features/finance/types'
import {
  buildFinancePendingClaimsCsv,
  normalizeFinanceFilters,
} from '@/features/finance/utils/filters'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const PAGE_EXPORT_LIMIT = 10
const ALL_EXPORT_BATCH_SIZE = 200

type ExportMode = 'page' | 'all'

const PENDING_CLAIMS_DATE_FILTER_OPTIONS: FinanceDateFilterField[] = [
  'claim_date',
  'submitted_at',
]

const PENDING_CLAIMS_DATE_FILTER_OPTION_SET = new Set(
  PENDING_CLAIMS_DATE_FILTER_OPTIONS
)

function getExportMode(value: string | null): ExportMode {
  return value === 'all' ? 'all' : 'page'
}

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

async function getAllPendingQueueRows(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  filters: ReturnType<typeof getPendingClaimsExportFilters>
) {
  const rows = []
  let cursor: string | null = null

  for (;;) {
    const page = await getFinanceQueuePaginated(
      supabase,
      cursor,
      ALL_EXPORT_BATCH_SIZE,
      filters
    )

    rows.push(...page.data)

    if (!page.hasNextPage || !page.nextCursor) {
      break
    }

    cursor = page.nextCursor
  }

  return rows
}

async function handleExportRequest(request: Request) {
  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams

    const mode = getExportMode(searchParams.get('mode'))
    const queueCursor = searchParams.get('queueCursor')
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

    const rows =
      mode === 'all'
        ? await getAllPendingQueueRows(supabase, filters)
        : (
            await getFinanceQueuePaginated(
              supabase,
              queueCursor,
              PAGE_EXPORT_LIMIT,
              filters
            )
          ).data

    const csv = buildFinancePendingClaimsCsv(rows)
    const dateStamp = new Date().toISOString().slice(0, 10)
    const filename = `pending-claims-${mode}-${dateStamp}.csv`

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
