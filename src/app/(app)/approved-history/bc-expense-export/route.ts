import { getEmployeeByEmail } from '@/lib/services/employee-service'
import { isFinanceTeamMember } from '@/features/finance/permissions'
import { getFinanceHistoryPaginated } from '@/features/finance/queries'
import { getMappedClaimItemsByClaimId } from '@/features/finance/queries/mapped-claim-items'
import { normalizeFinanceFilters } from '@/features/finance/utils/filters'
import {
  buildBcExpenseRows,
  BC_EXPENSE_CSV_HEADERS,
  toCsvLine,
} from '@/features/finance/utils/bc-expense-export'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getActiveExpenseTypeAccountMappings,
  getFinanceExportProfileByCode,
} from '@/lib/services/finance-export-config-service'
import { formatDate } from '@/lib/utils/date'
import {
  buildDatedCsvFilename,
  createCsvErrorResponse,
  createExportRouteHandlers,
} from '@/lib/utils/export-route'

const BC_EXPORT_PROFILE_CODE = 'BC_EXPENSE'
const HISTORY_CHUNK_SIZE = 500

type CsvChunkPage = {
  rows: string[][]
  nextCursor: string | null
}

type CsvChunkFetcher = (cursor: string | null) => Promise<CsvChunkPage>

function createStreamingCsvResponse(
  filename: string,
  headers: string[],
  fetcher: CsvChunkFetcher
): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`${toCsvLine(headers)}\n`))

        let cursor: string | null = null

        for (;;) {
          const page = await fetcher(cursor)

          if (page.rows.length > 0) {
            const chunk = page.rows.map((row) => toCsvLine(row)).join('\n')
            controller.enqueue(encoder.encode(`${chunk}\n`))
          }

          if (!page.nextCursor) {
            break
          }

          cursor = page.nextCursor
        }

        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'Transfer-Encoding': 'chunked',
    },
  })
}

async function handleExportRequest(request: Request) {
  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams

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

    const [exportProfile, mappings] = await Promise.all([
      getFinanceExportProfileByCode(supabase, BC_EXPORT_PROFILE_CODE),
      getActiveExpenseTypeAccountMappings(supabase),
    ])

    if (!exportProfile) {
      return new Response('BC export profile is not configured.', {
        status: 400,
      })
    }

    if (mappings.length === 0) {
      return new Response('Expense type account mappings are not configured.', {
        status: 400,
      })
    }

    const balAccountNoByItemType = new Map(
      mappings.map((row) => [row.expense_item_type, row.bal_account_no])
    )
    const mappedExpenseItemTypes = [...balAccountNoByItemType.keys()]
    const postingDate = formatDate(new Date())
    const filename = buildDatedCsvFilename('bc-expense', 'all')

    return createStreamingCsvResponse(
      filename,
      BC_EXPENSE_CSV_HEADERS,
      async (cursor) => {
        const historyPage = await getFinanceHistoryPaginated(
          supabase,
          cursor,
          HISTORY_CHUNK_SIZE,
          filters,
          { maxFilteredClaimIds: null }
        )

        const claimIds = [
          ...new Set(historyPage.data.map((historyRow) => historyRow.claim.id)),
        ]

        const claimItemsByClaimId = await getMappedClaimItemsByClaimId(
          supabase,
          claimIds,
          mappedExpenseItemTypes
        )

        const rows = buildBcExpenseRows({
          historyRows: historyPage.data,
          claimItemsByClaimId,
          balAccountNoByItemType,
          postingDate,
          exportProfile,
        })

        return {
          rows,
          nextCursor: historyPage.hasNextPage ? historyPage.nextCursor : null,
        }
      }
    )
  } catch (error) {
    return createCsvErrorResponse(error)
  }
}

export const { GET, POST } = createExportRouteHandlers(handleExportRequest)
