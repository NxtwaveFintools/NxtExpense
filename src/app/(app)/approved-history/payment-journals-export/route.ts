import { resolvePaymentJournalsExportContext } from '@/features/finance/server/payment-journals-export-context'
import { getFinancePaymentJournalTotals } from '@/features/finance/data/queries'
import {
  buildPaymentJournalsRows,
  PAYMENT_JOURNALS_CSV_HEADERS,
} from '@/features/finance/utils/payment-journals-export'
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

    const resolved = await resolvePaymentJournalsExportContext(
      supabase,
      user?.email ? { email: user.email } : null,
      url.searchParams
    )

    if (!resolved.ok) {
      return createCsvExportErrorResponse(resolved.message, resolved.status)
    }

    const { filters, defaults } = resolved.context
    const filename = buildDatedCsvFilename('payment-journals')

    return runCsvExport({
      fetchPage: async () => {
        const totalsByEmployeeId = await getFinancePaymentJournalTotals(
          supabase,
          filters
        )

        const rows = buildPaymentJournalsRows({
          totalsByEmployeeId,
          defaults,
        })

        return { data: rows, hasNextPage: false, nextCursor: null }
      },
      headers: PAYMENT_JOURNALS_CSV_HEADERS,
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
