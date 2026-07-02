import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createExportProgress } from '@/lib/utils/export-progress-registry'
import type { ExportPreflightHandler } from '@/lib/utils/export-preflight'
import { resolveMyClaimsExportPreflight } from '@/features/claims/server/claims-export-context'
import { resolveApprovalHistoryExportPreflight } from '@/features/approvals/server/approval-history-export-context'
import { resolveFinanceHistoryExportPreflight } from '@/features/finance/server/finance-history-export-context'
import { resolveFinancePendingExportPreflight } from '@/features/finance/server/finance-pending-export-context'
import { resolveBcExpenseExportPreflight } from '@/features/finance/server/bc-expense-export-context'
import { resolvePaymentJournalsExportPreflight } from '@/features/finance/server/payment-journals-export-context'

const EXPORT_PREFLIGHT_HANDLERS: Record<string, ExportPreflightHandler> = {
  'my-claims': resolveMyClaimsExportPreflight,
  'approval-history': resolveApprovalHistoryExportPreflight,
  'finance-history': resolveFinanceHistoryExportPreflight,
  'finance-pending': resolveFinancePendingExportPreflight,
  'bc-expense': resolveBcExpenseExportPreflight,
  'payment-journals': resolvePaymentJournalsExportPreflight,
}

type StartRequestBody = {
  exportType?: string
  query?: string
}

export async function POST(request: Request): Promise<Response> {
  let body: StartRequestBody

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const handler = body.exportType
    ? EXPORT_PREFLIGHT_HANDLERS[body.exportType]
    : undefined

  if (!handler) {
    return Response.json({ error: 'Unknown export type.' }, { status: 400 })
  }

  try {
    const searchParams = new URLSearchParams(body.query ?? '')
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const result = await handler(
      supabase,
      user?.email ? { email: user.email } : null,
      searchParams
    )

    if (!result.ok) {
      return Response.json({ error: result.message }, { status: result.status })
    }

    const requestId = createExportProgress(
      result.employeeId,
      result.estimatedTotalRows
    )

    return Response.json({ requestId })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to start export.',
      },
      { status: 400 }
    )
  }
}
