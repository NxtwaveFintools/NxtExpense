import { getEmployeeByEmail } from '@/lib/services/employee-service'
import { isFinanceTeamMember } from '@/features/finance/permissions'
import { getFinanceHistoryPaginated } from '@/features/finance/queries'
import { normalizeFinanceFilters } from '@/features/finance/utils/filters'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getFinanceExportProfileByCode,
  type FinanceExportProfile,
} from '@/lib/services/finance-export-config-service'
import {
  accumulatePaymentJournalsEmployeeTotals,
  buildPaymentJournalsRows,
  PAYMENT_JOURNALS_CSV_HEADERS,
  resolvePaymentJournalsDefaults,
  toCsvLine,
} from '@/features/finance/utils/payment-journals-export'
import {
  buildDatedCsvFilename,
  createCsvErrorResponse,
  createExportRouteHandlers,
} from '@/lib/utils/export-route'

const PAYMENT_JOURNALS_EXPORT_PROFILE_CODE = 'PAYMENT_JOURNALS'
const HISTORY_CHUNK_SIZE = 500

type CsvRowsBuilder = () => Promise<string[][]>

function createStreamingCsvResponse(
  filename: string,
  headers: string[],
  buildRows: CsvRowsBuilder
): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`${toCsvLine(headers)}\n`))

        const rows = await buildRows()

        if (rows.length > 0) {
          const chunk = rows.map((row) => toCsvLine(row)).join('\n')
          controller.enqueue(encoder.encode(`${chunk}\n`))
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

function ensureProfileExists(
  profile: FinanceExportProfile | null
): asserts profile {
  if (!profile) {
    throw new Error('Payment Journals export profile is not configured.')
  }
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

    const profile = await getFinanceExportProfileByCode(
      supabase,
      PAYMENT_JOURNALS_EXPORT_PROFILE_CODE
    )

    ensureProfileExists(profile)

    const defaults = resolvePaymentJournalsDefaults(profile)
    const seenClaimIds = new Set<string>()
    const totalsByEmployeeId = new Map<string, number>()
    const filename = buildDatedCsvFilename('payment-journals', 'all')

    return createStreamingCsvResponse(
      filename,
      PAYMENT_JOURNALS_CSV_HEADERS,
      async () => {
        let cursor: string | null = null

        for (;;) {
          const historyPage = await getFinanceHistoryPaginated(
            supabase,
            cursor,
            HISTORY_CHUNK_SIZE,
            filters,
            { maxFilteredClaimIds: null }
          )

          accumulatePaymentJournalsEmployeeTotals({
            historyRows: historyPage.data,
            seenClaimIds,
            totalsByEmployeeId,
          })

          if (!historyPage.hasNextPage || !historyPage.nextCursor) {
            break
          }

          cursor = historyPage.nextCursor
        }

        return buildPaymentJournalsRows({
          totalsByEmployeeId,
          defaults,
        })
      }
    )
  } catch (error) {
    return createCsvErrorResponse(error)
  }
}

export const { GET, POST } = createExportRouteHandlers(handleExportRequest)
