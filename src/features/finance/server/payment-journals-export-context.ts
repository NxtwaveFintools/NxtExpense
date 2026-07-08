import type { SupabaseClient } from '@supabase/supabase-js'

import { isFinanceTeamMember } from '@/features/finance/permissions'
import {
  getEmployeeByEmail,
  type EmployeeRow,
} from '@/lib/services/employee-service'
import { getFinanceExportProfileByCode } from '@/lib/services/finance-export-config-service'
import { normalizeFinanceFilters } from '@/features/finance/utils/filters'
import type { FinanceFilters } from '@/features/finance/types'
import { resolvePaymentJournalsDefaults } from '@/features/finance/utils/payment-journals-export'
import type { ExportPreflightResult } from '@/lib/utils/export-preflight'

const PAYMENT_JOURNALS_EXPORT_PROFILE_CODE = 'PAYMENT_JOURNALS'

export type PaymentJournalsExportContext = {
  employee: EmployeeRow
  filters: FinanceFilters
  defaults: ReturnType<typeof resolvePaymentJournalsDefaults>
}

export type PaymentJournalsExportContextResult =
  | { ok: true; context: PaymentJournalsExportContext }
  | { ok: false; status: number; message: string }

function buildPaymentJournalsExportFilters(
  searchParams: URLSearchParams
): FinanceFilters {
  return normalizeFinanceFilters({
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
}

export async function resolvePaymentJournalsExportContext(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<PaymentJournalsExportContextResult> {
  if (!user?.email) {
    return { ok: false, status: 401, message: 'Unauthorized request.' }
  }

  const employee = await getEmployeeByEmail(supabase, user.email)

  if (!employee || !(await isFinanceTeamMember(supabase, employee))) {
    return { ok: false, status: 403, message: 'Finance access is required.' }
  }

  const profile = await getFinanceExportProfileByCode(
    supabase,
    PAYMENT_JOURNALS_EXPORT_PROFILE_CODE
  )

  if (!profile) {
    return {
      ok: false,
      status: 400,
      message: 'Payment Journals export profile is not configured.',
    }
  }

  return {
    ok: true,
    context: {
      employee,
      filters: buildPaymentJournalsExportFilters(searchParams),
      defaults: resolvePaymentJournalsDefaults(profile),
    },
  }
}

export async function resolvePaymentJournalsExportPreflight(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<ExportPreflightResult> {
  const resolved = await resolvePaymentJournalsExportContext(
    supabase,
    user,
    searchParams
  )

  return resolved.ok ? { ok: true } : resolved
}
