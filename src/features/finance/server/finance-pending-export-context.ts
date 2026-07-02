import type { SupabaseClient } from '@supabase/supabase-js'

import { isFinanceTeamMember } from '@/features/finance/permissions'
import {
  getEmployeeByEmail,
  type EmployeeRow,
} from '@/lib/services/employee-service'
import { getFinanceQueueTotalCount } from '@/features/finance/data/queries'
import { normalizeFinanceFilters } from '@/features/finance/utils/filters'
import type {
  FinanceDateFilterField,
  FinanceFilters,
} from '@/features/finance/types'
import type { ExportPreflightResult } from '@/lib/utils/export-preflight'

export type FinancePendingExportContext = {
  employee: EmployeeRow
  filters: FinanceFilters
}

export type FinancePendingExportContextResult =
  | { ok: true; context: FinancePendingExportContext }
  | { ok: false; status: number; message: string }

const PENDING_CLAIMS_DATE_FILTER_OPTIONS: FinanceDateFilterField[] = [
  'claim_date',
  'submitted_at',
  'hod_approved_date',
]

const PENDING_CLAIMS_DATE_FILTER_OPTION_SET = new Set(
  PENDING_CLAIMS_DATE_FILTER_OPTIONS
)

function buildFinancePendingExportFilters(
  searchParams: URLSearchParams
): FinanceFilters {
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

export async function resolveFinancePendingExportContext(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<FinancePendingExportContextResult> {
  if (!user?.email) {
    return { ok: false, status: 401, message: 'Unauthorized request.' }
  }

  const employee = await getEmployeeByEmail(supabase, user.email)

  if (!employee || !(await isFinanceTeamMember(supabase, employee))) {
    return { ok: false, status: 403, message: 'Finance access is required.' }
  }

  return {
    ok: true,
    context: {
      employee,
      filters: buildFinancePendingExportFilters(searchParams),
    },
  }
}

export async function resolveFinancePendingExportPreflight(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<ExportPreflightResult> {
  const resolved = await resolveFinancePendingExportContext(
    supabase,
    user,
    searchParams
  )

  if (!resolved.ok) {
    return resolved
  }

  const { employee, filters } = resolved.context
  const estimatedTotalRows = await getFinanceQueueTotalCount(supabase, filters)

  return { ok: true, employeeId: employee.id, estimatedTotalRows }
}
