import type { SupabaseClient } from '@supabase/supabase-js'

// ────────────────────────────────────────────────────────────
// Admin summary stats
// ────────────────────────────────────────────────────────────

export type AdminSummary = {
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

export async function searchClaimsForAdmin(
  supabase: SupabaseClient,
  query: string,
  limit = 20
): Promise<AdminClaimRow[]> {
  const sanitized = query.trim()
  if (!sanitized) return []

  const { data, error } = await supabase
    .from('expense_claims')
    .select(
      `
      id, claim_number, claim_date, total_amount, status_id, submitted_at,
      claim_statuses!status_id ( status_code ),
      employees!employee_id ( employee_name, employee_email, designation ),
      work_locations!work_location_id ( location_name )
    `
    )
    .or(
      `claim_number.ilike.%${sanitized}%,employees.employee_name.ilike.%${sanitized}%`
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const emp = row.employees as unknown as {
      employee_name: string
      employee_email: string
      designation: string
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
      designation: emp?.designation ?? '',
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
  designation: string
  state: string
  approval_employee_id_level_1: string | null
  approval_employee_id_level_2: string | null
  approval_employee_id_level_3: string | null
}

export async function searchEmployeesForAdmin(
  supabase: SupabaseClient,
  query: string,
  limit = 20
): Promise<AdminEmployeeRow[]> {
  const sanitized = query.trim()
  if (!sanitized) return []

  const { data, error } = await supabase
    .from('employees')
    .select(
      `
      id, employee_id, employee_name, employee_email, designation, state,
      approval_employee_id_level_1, approval_employee_id_level_2, approval_employee_id_level_3
    `
    )
    .or(
      `employee_name.ilike.%${sanitized}%,employee_email.ilike.%${sanitized}%,employee_id.ilike.%${sanitized}%`
    )
    .order('employee_name')
    .limit(limit)

  if (error) throw new Error(error.message)

  return data ?? []
}
