import type { SupabaseClient } from '@supabase/supabase-js'

import { canAccessEmployeeClaims } from '@/features/employees/permissions'
import {
  getEmployeeByEmail,
  type EmployeeRow,
} from '@/lib/services/employee-service'
import { canDownloadClaimsCsv } from '@/features/claims/utils/export-permissions'
import { getMyClaimsTotalCount } from '@/features/claims/data/repositories/claims.repository'
import { normalizeMyClaimsFilters } from '@/features/claims/utils/filters'
import type { MyClaimsFilters } from '@/features/claims/types'
import type { ExportPreflightResult } from '@/lib/utils/export-preflight'

export type MyClaimsExportContext = {
  employee: EmployeeRow
  filters: MyClaimsFilters
}

export type MyClaimsExportContextResult =
  | { ok: true; context: MyClaimsExportContext }
  | { ok: false; status: number; message: string }

export async function resolveMyClaimsExportContext(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<MyClaimsExportContextResult> {
  if (!user?.email) {
    return { ok: false, status: 401, message: 'Unauthorized request.' }
  }

  const employee = await getEmployeeByEmail(supabase, user.email)

  if (!employee || !(await canAccessEmployeeClaims(supabase, employee))) {
    return { ok: false, status: 403, message: 'Claims access is required.' }
  }

  if (!canDownloadClaimsCsv(employee.designations?.designation_name)) {
    return {
      ok: false,
      status: 403,
      message: 'CSV export is not available for your designation.',
    }
  }

  const filters = normalizeMyClaimsFilters({
    claimStatus: searchParams.get('claimStatus') ?? undefined,
    workLocation: searchParams.get('workLocation') ?? undefined,
    claimDateFrom: searchParams.get('claimDateFrom') ?? undefined,
    claimDateTo: searchParams.get('claimDateTo') ?? undefined,
  })

  return { ok: true, context: { employee, filters } }
}

export async function resolveMyClaimsExportPreflight(
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
): Promise<ExportPreflightResult> {
  const resolved = await resolveMyClaimsExportContext(
    supabase,
    user,
    searchParams
  )

  if (!resolved.ok) {
    return resolved
  }

  const { employee, filters } = resolved.context
  const estimatedTotalRows = await getMyClaimsTotalCount(
    supabase,
    employee.id,
    filters
  )

  return { ok: true, employeeId: employee.id, estimatedTotalRows }
}
