import type { SupabaseClient } from '@supabase/supabase-js'

// ────────────────────────────────────────────────────────────
// Employee types (ID-based)
// ────────────────────────────────────────────────────────────

export type EmployeeRow = {
  id: string
  employee_id: string
  employee_name: string
  employee_email: string
  designation_id: string | null
  employee_status_id: string | null
  approval_employee_id_level_1: string | null
  approval_employee_id_level_2: string | null
  approval_employee_id_level_3: string | null
  created_at: string
  employee_statuses: { status_code: string } | null
  designations: { designation_name: string } | null
  employee_states: Array<{
    is_primary: boolean
    states: { state_name: string } | null
  }> | null
}

export type EmployeeRole = {
  role_id: string
  role_code: string
  is_finance_role: boolean
  is_admin_role: boolean
  role_name: string
}

export type EmployeeAccessState = 'active' | 'inactive' | 'missing'

// ────────────────────────────────────────────────────────────
// Column selection
// ────────────────────────────────────────────────────────────

const EMPLOYEE_COLUMNS =
  'id, employee_id, employee_name, employee_email, designation_id, employee_status_id, approval_employee_id_level_1, approval_employee_id_level_2, approval_employee_id_level_3, created_at, employee_statuses!employee_status_id(status_code), designations!designation_id(designation_name), employee_states!employee_id(is_primary, states!state_id(state_name))'

const EMPLOYEE_FETCH_MAX_RETRIES = 1

function isTransientFetchError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('fetch failed') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('network') ||
    normalized.includes('timeout') ||
    normalized.includes('terminated')
  )
}

// ────────────────────────────────────────────────────────────
// Core lookups
// ────────────────────────────────────────────────────────────

async function getEmployeeRecordByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<EmployeeRow | null> {
  for (let attempt = 0; attempt <= EMPLOYEE_FETCH_MAX_RETRIES; attempt += 1) {
    const { data, error } = await supabase
      .from('employees')
      .select(EMPLOYEE_COLUMNS)
      .eq('employee_email', email.toLowerCase())
      .maybeSingle()

    if (!error) return data as EmployeeRow | null

    const shouldRetry =
      attempt < EMPLOYEE_FETCH_MAX_RETRIES &&
      isTransientFetchError(error.message)

    if (shouldRetry) {
      await new Promise((resolve) => setTimeout(resolve, 200))
      continue
    }

    throw new Error(error.message)
  }

  throw new Error('Employee lookup failed unexpectedly.')
}

export function isEmployeeActive(
  employee: EmployeeRow | null | undefined
): employee is EmployeeRow {
  if (!employee) {
    return false
  }

  return (employee.employee_statuses?.status_code ?? 'ACTIVE') === 'ACTIVE'
}

export async function getEmployeeAccessByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<{
  employee: EmployeeRow | null
  accessState: EmployeeAccessState
}> {
  const employee = await getEmployeeRecordByEmail(supabase, email)

  if (!employee) {
    return {
      employee: null,
      accessState: 'missing',
    }
  }

  return {
    employee,
    accessState: isEmployeeActive(employee) ? 'active' : 'inactive',
  }
}

export async function getEmployeeByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<EmployeeRow | null> {
  const { employee, accessState } = await getEmployeeAccessByEmail(
    supabase,
    email
  )

  return accessState === 'active' ? employee : null
}

export async function getEmployeeById(
  supabase: SupabaseClient,
  id: string
): Promise<EmployeeRow | null> {
  const { data, error } = await supabase
    .from('employees')
    .select(EMPLOYEE_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as EmployeeRow | null
}

export async function getEmployeeNameMapByIds(
  supabase: SupabaseClient,
  employeeIds: string[]
): Promise<Record<string, string>> {
  const uniqueIds = Array.from(new Set(employeeIds.filter(Boolean)))

  if (uniqueIds.length === 0) {
    return {}
  }

  const { data, error } = await supabase
    .from('employees')
    .select('id, employee_name')
    .in('id', uniqueIds)

  if (error) {
    throw new Error(error.message)
  }

  const result: Record<string, string> = {}

  for (const row of data ?? []) {
    const employee = row as { id: string; employee_name: string }
    result[employee.id] = employee.employee_name
  }

  return result
}

// ────────────────────────────────────────────────────────────
// Roles (via employee_roles junction)
// ────────────────────────────────────────────────────────────

export async function getEmployeeRoles(
  supabase: SupabaseClient,
  employeeId: string
): Promise<EmployeeRole[]> {
  const { data, error } = await supabase
    .from('employee_roles')
    .select(
      'role_id, roles(id, role_code, role_name, is_finance_role, is_admin_role)'
    )
    .eq('employee_id', employeeId)
    .eq('is_active', true)

  if (error) throw new Error(`Failed to fetch employee roles: ${error.message}`)

  return (data ?? []).map((row: Record<string, unknown>) => {
    const role = row.roles as {
      id: string
      role_code: string
      role_name: string
      is_finance_role: boolean
      is_admin_role: boolean
    }
    return {
      role_id: role.id,
      role_code: role.role_code,
      role_name: role.role_name,
      is_finance_role: role.is_finance_role ?? false,
      is_admin_role: role.is_admin_role ?? false,
    }
  })
}

// ────────────────────────────────────────────────────────────
// Approver assignments (checks approval_routing + employee_roles)
// ────────────────────────────────────────────────────────────

export async function hasApproverAssignments(
  supabase: SupabaseClient,
  approverEmail: string
): Promise<boolean> {
  // Look up the approver employee ID from their email first
  const { data: approverRow, error: approverError } = await supabase
    .from('employees')
    .select('id')
    .eq('employee_email', approverEmail.toLowerCase())
    .maybeSingle()

  if (approverError) throw new Error(approverError.message)
  if (!approverRow) return false

  const approverId = approverRow.id

  // Check L1, L2, and L3 assignments.
  // L2 actors (for example ZBH) can have read-only approvals visibility.
  const [level1, level2, level3] = await Promise.all([
    supabase
      .from('employees')
      .select('id')
      .eq('approval_employee_id_level_1', approverId)
      .limit(1),
    supabase
      .from('employees')
      .select('id')
      .eq('approval_employee_id_level_2', approverId)
      .limit(1),
    supabase
      .from('employees')
      .select('id')
      .eq('approval_employee_id_level_3', approverId)
      .limit(1),
  ])

  if (level1.error) throw new Error(level1.error.message)
  if (level2.error) throw new Error(level2.error.message)
  if (level3.error) throw new Error(level3.error.message)

  return (
    (level1.data?.length ?? 0) > 0 ||
    (level2.data?.length ?? 0) > 0 ||
    (level3.data?.length ?? 0) > 0
  )
}
