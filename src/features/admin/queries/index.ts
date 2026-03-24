import type { SupabaseClient } from '@supabase/supabase-js'

function escapeIlikeValue(input: string): string {
  return input.replace(/[%_]/g, '').replace(/,/g, ' ').trim()
}

// ────────────────────────────────────────────────────────────
// Admin summary stats
// ────────────────────────────────────────────────────────────

type AdminSummary = {
  totalEmployees: number
  totalClaims: number
  pendingClaims: number
  designationCount: number
  workLocationCount: number
  vehicleTypeCount: number
}

export async function getAdminSummary(
  supabase: SupabaseClient
): Promise<AdminSummary> {
  // Fetch UUIDs for all active pending-review statuses from the DB by semantic
  // properties — no hardcoded status code strings needed.
  const { data: pendingStatuses } = await supabase
    .from('claim_statuses')
    .select('id')
    .not('approval_level', 'is', null)
    .eq('is_terminal', false)
    .eq('is_rejection', false)
    .eq('is_approval', false)
    .eq('is_active', true)

  const pendingStatusIds = (pendingStatuses ?? []).map((s) => s.id)

  const [
    employees,
    claims,
    pendingClaims,
    designations,
    workLocations,
    vehicleTypes,
  ] = await Promise.all([
    supabase.from('employees').select('id', { count: 'exact', head: true }),
    supabase
      .from('expense_claims')
      .select('id', { count: 'exact', head: true }),
    pendingStatusIds.length > 0
      ? supabase
          .from('expense_claims')
          .select('id', { count: 'exact', head: true })
          .in('status_id', pendingStatusIds)
      : Promise.resolve({ count: 0 }),
    supabase
      .from('designations')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('work_locations')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('vehicle_types')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
  ])

  return {
    totalEmployees: employees.count ?? 0,
    totalClaims: claims.count ?? 0,
    pendingClaims: pendingClaims.count ?? 0,
    designationCount: designations.count ?? 0,
    workLocationCount: workLocations.count ?? 0,
    vehicleTypeCount: vehicleTypes.count ?? 0,
  }
}

// ────────────────────────────────────────────────────────────
// Claim search for admin rollback
// ────────────────────────────────────────────────────────────

export type AdminClaimRow = {
  id: string
  claim_number: string
  claim_date: string
  total_amount: number
  status: string
  employee_name: string
  employee_email: string
  designation: string
  work_location: string
  submitted_at: string | null
}

export type AdminClaimStatusOption = {
  id: string
  status_code: string
  status_name: string
  approval_level: number | null
}

export async function getAdminClaimStatusOptions(
  supabase: SupabaseClient
): Promise<AdminClaimStatusOption[]> {
  const { data, error } = await supabase
    .from('claim_statuses')
    .select('id, status_code, status_name, approval_level, display_order')
    .eq('is_active', true)
    .eq('is_terminal', false)
    .eq('is_rejection', false)
    .eq('is_approval', false)
    .order('display_order', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    status_code: row.status_code,
    status_name: row.status_name,
    approval_level: row.approval_level,
  }))
}

export async function searchClaimsForAdmin(
  supabase: SupabaseClient,
  query: string,
  limit = 20
): Promise<AdminClaimRow[]> {
  const sanitized = escapeIlikeValue(query)
  if (!sanitized) return []

  const pattern = `%${sanitized}%`

  const { data: matchedEmployees, error: employeeLookupError } = await supabase
    .from('employees')
    .select('id')
    .or(`employee_name.ilike.${pattern},employee_email.ilike.${pattern}`)
    .limit(100)

  if (employeeLookupError) {
    throw new Error(employeeLookupError.message)
  }

  const employeeIds = (matchedEmployees ?? []).map((row) => row.id)

  let claimsQuery = supabase.from('expense_claims').select(
    `
      id, claim_number, claim_date, total_amount, status_id, submitted_at,
      claim_statuses!status_id ( status_code ),
      employees!employee_id (
        employee_name,
        employee_email,
        designations!designation_id ( designation_name )
      ),
      work_locations!work_location_id ( location_name )
    `
  )

  if (employeeIds.length > 0) {
    claimsQuery = claimsQuery.or(
      `claim_number.ilike.${pattern},employee_id.in.(${employeeIds.join(',')})`
    )
  } else {
    claimsQuery = claimsQuery.ilike('claim_number', pattern)
  }

  const { data, error } = await claimsQuery
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const emp = row.employees as unknown as {
      employee_name: string
      employee_email: string
      designations?: {
        designation_name: string
      } | null
    } | null
    const wl = row.work_locations as unknown as {
      location_name: string
    } | null
    const cs = row.claim_statuses as unknown as {
      status_code: string
    } | null

    return {
      id: row.id,
      claim_number: row.claim_number,
      claim_date: row.claim_date,
      total_amount: Number(row.total_amount),
      status: cs?.status_code ?? '',
      employee_name: emp?.employee_name ?? '',
      employee_email: emp?.employee_email ?? '',
      designation: emp?.designations?.designation_name ?? '',
      work_location: wl?.location_name ?? '',
      submitted_at: row.submitted_at,
    }
  })
}

// ────────────────────────────────────────────────────────────
// Employee search for reassignment
// ────────────────────────────────────────────────────────────

export type AdminEmployeeRow = {
  id: string
  employee_id: string
  employee_name: string
  employee_email: string
  designation_id: string | null
  role_id: string | null
  state_id: string | null
  employee_status_code: string | null
  employee_status_name: string | null
  designation: string
  state: string
  approval_employee_id_level_1: string | null
  approval_employee_id_level_2: string | null
  approval_employee_id_level_3: string | null
  current_approval_email_level_1: string | null
  current_approval_email_level_2: string | null
  current_approval_email_level_3: string | null
}

export async function searchEmployeesForAdmin(
  supabase: SupabaseClient,
  query: string,
  limit = 20
): Promise<AdminEmployeeRow[]> {
  const sanitized = escapeIlikeValue(query)
  if (!sanitized) return []

  const { data, error } = await supabase
    .from('employees')
    .select(
      `
      id, employee_id, employee_name, employee_email, designation_id,
      approval_employee_id_level_1, approval_employee_id_level_2, approval_employee_id_level_3,
      employee_statuses!employee_status_id(status_code, status_name),
      employee_roles!employee_id(role_id, is_active, assigned_at),
      designations!designation_id(designation_name),
      employee_states!employee_id(is_primary, state_id, states!state_id(state_name))
    `
    )
    .or(
      `employee_name.ilike.%${sanitized}%,employee_email.ilike.%${sanitized}%,employee_id.ilike.%${sanitized}%`
    )
    .order('employee_name')
    .limit(limit)

  if (error) throw new Error(error.message)

  const mappedRows = (data ?? []).map((row) => {
    const designationRelation = row.designations as
      | { designation_name: string }
      | Array<{ designation_name: string }>
      | null
      | undefined
    const designation = Array.isArray(designationRelation)
      ? designationRelation[0]
      : designationRelation

    const employeeStates =
      (row.employee_states as unknown as Array<{
        is_primary: boolean
        state_id: string
        states: { state_name: string } | Array<{ state_name: string }> | null
      }>) ?? []

    const primaryState =
      employeeStates.find((state) => state.is_primary) ?? employeeStates[0]
    const stateRelation = primaryState?.states
    const stateValue = Array.isArray(stateRelation)
      ? stateRelation[0]
      : stateRelation

    const statusRelation = row.employee_statuses as
      | { status_code: string; status_name: string }
      | Array<{ status_code: string; status_name: string }>
      | null
      | undefined
    const status = Array.isArray(statusRelation)
      ? statusRelation[0]
      : statusRelation

    const roleRelations =
      (row.employee_roles as unknown as Array<{
        role_id: string
        is_active: boolean
        assigned_at: string | null
      }>) ?? []

    const activeRoles = roleRelations.filter((role) => role.is_active)
    const latestRole =
      activeRoles.sort((a, b) =>
        (b.assigned_at ?? '').localeCompare(a.assigned_at ?? '')
      )[0] ?? null

    const primaryStateId = primaryState?.state_id ?? null

    return {
      id: row.id,
      employee_id: row.employee_id,
      employee_name: row.employee_name,
      employee_email: row.employee_email,
      designation_id: row.designation_id,
      role_id: latestRole?.role_id ?? null,
      state_id: primaryStateId,
      employee_status_code: status?.status_code ?? null,
      employee_status_name: status?.status_name ?? null,
      designation: designation?.designation_name ?? '',
      state: stateValue?.state_name ?? '',
      approval_employee_id_level_1: row.approval_employee_id_level_1,
      approval_employee_id_level_2: row.approval_employee_id_level_2,
      approval_employee_id_level_3: row.approval_employee_id_level_3,
      current_approval_email_level_1: null,
      current_approval_email_level_2: null,
      current_approval_email_level_3: null,
    }
  })

  const approverIds = Array.from(
    new Set(
      mappedRows
        .flatMap((row) => [
          row.approval_employee_id_level_1,
          row.approval_employee_id_level_2,
          row.approval_employee_id_level_3,
        ])
        .filter((value): value is string => Boolean(value))
    )
  )

  if (approverIds.length === 0) {
    return mappedRows
  }

  const { data: approverRows, error: approverError } = await supabase
    .from('employees')
    .select('id, employee_email')
    .in('id', approverIds)

  if (approverError) {
    throw new Error(approverError.message)
  }

  const approverEmailById = new Map(
    (approverRows ?? []).map((row) => [row.id, row.employee_email])
  )

  return mappedRows.map((row) => ({
    ...row,
    current_approval_email_level_1: row.approval_employee_id_level_1
      ? (approverEmailById.get(row.approval_employee_id_level_1) ?? null)
      : null,
    current_approval_email_level_2: row.approval_employee_id_level_2
      ? (approverEmailById.get(row.approval_employee_id_level_2) ?? null)
      : null,
    current_approval_email_level_3: row.approval_employee_id_level_3
      ? (approverEmailById.get(row.approval_employee_id_level_3) ?? null)
      : null,
  }))
}
