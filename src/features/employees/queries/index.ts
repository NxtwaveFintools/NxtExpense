import type { SupabaseClient } from '@supabase/supabase-js'

import type { ApprovalChain, Employee } from '@/features/employees/types'

const EMPLOYEE_COLUMNS =
  'id, employee_id, employee_name, employee_email, state, designation, approval_email_level_1, approval_email_level_2, approval_email_level_3, created_at'

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

async function waitBeforeRetry(delayMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs))
}

export async function getEmployeeByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<Employee | null> {
  for (let attempt = 0; attempt <= EMPLOYEE_FETCH_MAX_RETRIES; attempt += 1) {
    const { data, error } = await supabase
      .from('employees')
      .select(EMPLOYEE_COLUMNS)
      .eq('employee_email', email.toLowerCase())
      .maybeSingle()

    if (!error) {
      return data as Employee | null
    }

    const shouldRetry =
      attempt < EMPLOYEE_FETCH_MAX_RETRIES &&
      isTransientFetchError(error.message)

    if (shouldRetry) {
      await waitBeforeRetry(200)
      continue
    }

    throw new Error(error.message)
  }

  throw new Error('Employee lookup failed unexpectedly.')
}

export async function getEmployeeById(
  supabase: SupabaseClient,
  id: string
): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('employees')
    .select(EMPLOYEE_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data as Employee | null
}

export async function hasApproverAssignments(
  supabase: SupabaseClient,
  approverEmail: string
): Promise<boolean> {
  const normalizedEmail = approverEmail.toLowerCase()

  const [level1, level2, level3] = await Promise.all([
    supabase
      .from('employees')
      .select('id')
      .eq('approval_email_level_1', normalizedEmail)
      .limit(1),
    supabase
      .from('employees')
      .select('id')
      .eq('approval_email_level_2', normalizedEmail)
      .limit(1),
    supabase
      .from('employees')
      .select('id')
      .eq('approval_email_level_3', normalizedEmail)
      .limit(1),
  ])

  if (level1.error) {
    throw new Error(level1.error.message)
  }

  if (level2.error) {
    throw new Error(level2.error.message)
  }

  if (level3.error) {
    throw new Error(level3.error.message)
  }

  return (
    (level1.data?.length ?? 0) > 0 ||
    (level2.data?.length ?? 0) > 0 ||
    (level3.data?.length ?? 0) > 0
  )
}

export function getEmployeeApprovalChain(employee: Employee): ApprovalChain {
  return {
    level1: employee.approval_email_level_1,
    level2: employee.approval_email_level_2,
    level3: employee.approval_email_level_3,
  }
}
