import type { SupabaseClient } from '@supabase/supabase-js'

import { isFinanceTeamMember } from '@/features/finance/permissions'
import {
  getEmployeeByEmail,
  type EmployeeRow,
} from '@/lib/services/employee-service'
import {
  getActiveExpenseTypeAccountMappings,
  getFinanceExportProfileByCode,
  type FinanceExportProfile,
} from '@/lib/services/finance-export-config-service'
import { normalizeFinanceFilters } from '@/features/finance/utils/filters'
import type { FinanceFilters } from '@/features/finance/types'
import { formatDate } from '@/lib/utils/date'
import type { ExportPreflightResult } from '@/lib/utils/export-preflight'

const BC_EXPORT_PROFILE_CODE = 'BC_EXPENSE'

export type BcExpenseExportContext = {
  employee: EmployeeRow
  filters: FinanceFilters
  exportProfile: FinanceExportProfile
  balAccountNoByItemType: Map<string, string>
  mappedExpenseItemTypes: string[]
  postingDate: string
}

export type BcExpenseExportContextResult =
  | { ok: true; context: BcExpenseExportContext }
  | { ok: false; status: number; message: string }

function buildBcExpenseExportFilters(
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

export async function resolveBcExpenseExportContext(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<BcExpenseExportContextResult> {
  if (!user?.email) {
    return { ok: false, status: 401, message: 'Unauthorized request.' }
  }

  const employee = await getEmployeeByEmail(supabase, user.email)

  if (!employee || !(await isFinanceTeamMember(supabase, employee))) {
    return { ok: false, status: 403, message: 'Finance access is required.' }
  }

  const [exportProfile, mappings] = await Promise.all([
    getFinanceExportProfileByCode(supabase, BC_EXPORT_PROFILE_CODE),
    getActiveExpenseTypeAccountMappings(supabase),
  ])

  if (!exportProfile) {
    return {
      ok: false,
      status: 400,
      message: 'BC export profile is not configured.',
    }
  }

  if (mappings.length === 0) {
    return {
      ok: false,
      status: 400,
      message: 'Expense type account mappings are not configured.',
    }
  }

  const balAccountNoByItemType = new Map(
    mappings.map((row) => [row.expense_item_type, row.bal_account_no])
  )

  return {
    ok: true,
    context: {
      employee,
      filters: buildBcExpenseExportFilters(searchParams),
      exportProfile,
      balAccountNoByItemType,
      mappedExpenseItemTypes: [...balAccountNoByItemType.keys()],
      postingDate: formatDate(new Date()),
    },
  }
}

export async function resolveBcExpenseExportPreflight(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<ExportPreflightResult> {
  const resolved = await resolveBcExpenseExportContext(
    supabase,
    user,
    searchParams
  )

  return resolved.ok ? { ok: true } : resolved
}
