import type { SupabaseClient } from '@supabase/supabase-js'

import { isFinanceTeamMember } from '@/features/finance/permissions'
import {
  getEmployeeByEmail,
  type EmployeeRow,
} from '@/lib/services/employee-service'
import { getFinanceHistoryTotalCount } from '@/features/finance/data/queries'
import { normalizeFinanceFilters } from '@/features/finance/utils/filters'
import type { FinanceFilters } from '@/features/finance/types'
import type { ExportPreflightResult } from '@/lib/utils/export-preflight'

export type FinanceHistoryExportContext = {
  employee: EmployeeRow
  filters: FinanceFilters
}

export type FinanceHistoryExportContextResult =
  | { ok: true; context: FinanceHistoryExportContext }
  | { ok: false; status: number; message: string }

function buildFinanceHistoryExportFilters(
  searchParams: URLSearchParams
): FinanceFilters {
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

  // finance/export (also served at /approved-history/export) never supports
  // status filtering — matches the Approved History page's own filter scope.
  return { ...filters, claimStatus: null }
}

export async function resolveFinanceHistoryExportContext(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<FinanceHistoryExportContextResult> {
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
      filters: buildFinanceHistoryExportFilters(searchParams),
    },
  }
}

export async function resolveFinanceHistoryExportPreflight(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<ExportPreflightResult> {
  const resolved = await resolveFinanceHistoryExportContext(
    supabase,
    user,
    searchParams
  )

  if (!resolved.ok) {
    return resolved
  }

  const { employee, filters } = resolved.context
  const estimatedTotalRows = await getFinanceHistoryTotalCount(
    supabase,
    filters
  )

  return { ok: true, employeeId: employee.id, estimatedTotalRows }
}
