import { resolveBcExpenseExportContext } from '@/features/finance/server/bc-expense-export-context'
import {
  getFinanceHistoryPageForExport,
  getMappedClaimItemsByClaimId,
} from '@/features/finance/data/queries'
import {
  buildBcExpenseRows,
  BC_EXPENSE_CSV_HEADERS,
} from '@/features/finance/utils/bc-expense-export'
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

    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const resolved = await resolveBcExpenseExportContext(
      supabase,
      user?.email ? { email: user.email } : null,
      url.searchParams
    )

    if (!resolved.ok) {
      return createCsvExportErrorResponse(resolved.message, resolved.status)
    }

    const {
      filters,
      exportProfile,
      balAccountNoByItemType,
      mappedExpenseItemTypes,
      postingDate,
    } = resolved.context
    const filename = buildDatedCsvFilename('bc-expense')

    return runCsvExport({
      fetchPage: async (cursor, limit) => {
        const historyPage = await getFinanceHistoryPageForExport(
          supabase,
          cursor,
          limit,
          filters
        )

        const claimIds = [
          ...new Set(historyPage.data.map((row) => row.claim.id)),
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
          data: rows,
          hasNextPage: historyPage.hasNextPage,
          nextCursor: historyPage.nextCursor,
        }
      },
      headers: BC_EXPENSE_CSV_HEADERS,
      mapRow: (row: string[]) => row,
      filename,
    })
  } catch (error) {
    return createCsvExportErrorResponse(
      error instanceof Error ? error.message : 'Failed to export CSV.',
      400
    )
  }
}

export const { GET, POST } = createExportRouteHandlers(handleExportRequest)
