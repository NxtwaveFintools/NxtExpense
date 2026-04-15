import { getEmployeeByEmail } from '@/lib/services/employee-service'
import { isFinanceTeamMember } from '@/features/finance/permissions'
import { getFinanceHistoryPaginated } from '@/features/finance/queries'
import { normalizeFinanceFilters } from '@/features/finance/utils/filters'
import {
  buildBcExpenseRows,
  BC_EXPENSE_CSV_HEADERS,
  type ClaimExpenseItemRow,
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

function toNormalizedAmount(value: number | string): number {
  const numericValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

async function getClaimItemsForExportChunk(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  claimIds: string[],
  mappedExpenseItemTypes: string[]
): Promise<Map<string, ClaimExpenseItemRow[]>> {
  if (claimIds.length === 0 || mappedExpenseItemTypes.length === 0) {
    return new Map<string, ClaimExpenseItemRow[]>()
  }

  const { data, error } = await supabase
    .from('expense_claim_items')
    .select('claim_id, item_type, amount')
    .in('claim_id', claimIds)
    .in('item_type', mappedExpenseItemTypes)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as Array<{
    claim_id: string
    item_type: string
    amount: number | string
  }>

  const claimItemsByClaimId = new Map<string, ClaimExpenseItemRow[]>()

  for (const row of rows) {
    const item: ClaimExpenseItemRow = {
      claim_id: row.claim_id,
      item_type: row.item_type,
      amount: toNormalizedAmount(row.amount),
    }

    const currentRows = claimItemsByClaimId.get(row.claim_id)

    if (currentRows) {
      currentRows.push(item)
      continue
    }

    claimItemsByClaimId.set(row.claim_id, [item])
  }

  return claimItemsByClaimId
}

async function handleExportRequest(request: Request) {
  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams

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
          effectiveFilters
        )

        const claimIds = [
          ...new Set(historyPage.data.map((historyRow) => historyRow.claim.id)),
        ]

        const claimItemsByClaimId = await getClaimItemsForExportChunk(
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
