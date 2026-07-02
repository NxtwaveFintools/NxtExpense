import type { SupabaseClient } from '@supabase/supabase-js'

import { canAccessApprovals } from '@/features/employees/permissions'
import {
  getEmployeeByEmail,
  hasApproverAssignments,
  type EmployeeRow,
} from '@/lib/services/employee-service'
import { getFilteredApprovalHistoryCount } from '@/features/approvals/data/queries'
import { normalizeApprovalHistoryFilters } from '@/features/approvals/utils/history-filters'
import type { ApprovalHistoryFilters } from '@/features/approvals/types'
import type { ExportPreflightResult } from '@/lib/utils/export-preflight'

export type ApprovalHistoryExportContext = {
  employee: EmployeeRow
  filters: ApprovalHistoryFilters
}

export type ApprovalHistoryExportContextResult =
  | { ok: true; context: ApprovalHistoryExportContext }
  | { ok: false; status: number; message: string }

function buildFiltersFromSearchParams(
  searchParams: URLSearchParams
): ApprovalHistoryFilters {
  return normalizeApprovalHistoryFilters({
    claimStatus: searchParams.get('claimStatus') ?? undefined,
    employeeName: searchParams.get('employeeName') ?? undefined,
    claimDateFrom: searchParams.get('claimDateFrom') ?? undefined,
    claimDateTo: searchParams.get('claimDateTo') ?? undefined,
    amountOperator: searchParams.get('amountOperator') ?? undefined,
    amountValue: searchParams.get('amountValue') ?? undefined,
    locationType: searchParams.get('locationType') ?? undefined,
    claimDateSort: searchParams.get('claimDateSort') ?? undefined,
    hodApprovedFrom: searchParams.get('hodApprovedFrom') ?? undefined,
    hodApprovedTo: searchParams.get('hodApprovedTo') ?? undefined,
    financeApprovedFrom: searchParams.get('financeApprovedFrom') ?? undefined,
    financeApprovedTo: searchParams.get('financeApprovedTo') ?? undefined,
  })
}

export async function resolveApprovalHistoryExportContext(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<ApprovalHistoryExportContextResult> {
  if (!user?.email) {
    return { ok: false, status: 401, message: 'Unauthorized request.' }
  }

  const employee = await getEmployeeByEmail(supabase, user.email)

  if (!employee) {
    return { ok: false, status: 403, message: 'Approver profile not found.' }
  }

  const approverAccess = await hasApproverAssignments(
    supabase,
    employee.employee_email
  )

  if (!canAccessApprovals(approverAccess)) {
    return { ok: false, status: 403, message: 'Access denied.' }
  }

  return {
    ok: true,
    context: { employee, filters: buildFiltersFromSearchParams(searchParams) },
  }
}

export async function resolveApprovalHistoryExportPreflight(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<ExportPreflightResult> {
  const resolved = await resolveApprovalHistoryExportContext(
    supabase,
    user,
    searchParams
  )

  if (!resolved.ok) {
    return resolved
  }

  const { employee, filters } = resolved.context
  const estimatedTotalRows = await getFilteredApprovalHistoryCount(
    supabase,
    filters
  )

  return { ok: true, employeeId: employee.id, estimatedTotalRows }
}
