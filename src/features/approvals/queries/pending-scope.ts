import type { SupabaseClient } from '@supabase/supabase-js'

type EmployeeIdRow = {
  id: string
}

type ActorDesignationRow = {
  designation_id: string | null
  designations:
    | {
        designation_code: string
      }
    | Array<{
        designation_code: string
      }>
    | null
}

type PendingApprovalScope = {
  level1ActionEmployeeIds: string[]
  level2ActionEmployeeIds: string[]
  level1ViewOnlyEmployeeIds: string[]
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)]
}

function isZonalBusinessHeadDesignation(
  designation: ActorDesignationRow['designations'] | undefined | null
): boolean {
  const designationRow = Array.isArray(designation)
    ? (designation[0] ?? null)
    : designation

  return designationRow?.designation_code === 'ZBH'
}

export async function getPendingApprovalScopeByActor(
  supabase: SupabaseClient,
  actorEmployeeId: string
): Promise<PendingApprovalScope> {
  const [
    actorDesignationResult,
    level1Employees,
    level2Employees,
    level3Employees,
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('designation_id, designations!designation_id(designation_code)')
      .eq('id', actorEmployeeId)
      .maybeSingle(),
    supabase
      .from('employees')
      .select('id')
      .eq('approval_employee_id_level_1', actorEmployeeId),
    supabase
      .from('employees')
      .select('id')
      .eq('approval_employee_id_level_2', actorEmployeeId),
    supabase
      .from('employees')
      .select('id')
      .eq('approval_employee_id_level_3', actorEmployeeId),
  ])

  if (actorDesignationResult.error) {
    throw new Error(actorDesignationResult.error.message)
  }

  if (level1Employees.error) {
    throw new Error(level1Employees.error.message)
  }

  if (level2Employees.error) {
    throw new Error(level2Employees.error.message)
  }

  if (level3Employees.error) {
    throw new Error(level3Employees.error.message)
  }

  const actorDesignation =
    (actorDesignationResult.data as ActorDesignationRow | null)?.designations ??
    null
  const isZbh = isZonalBusinessHeadDesignation(actorDesignation)

  return {
    level1ActionEmployeeIds: uniqueIds(
      ((level1Employees.data ?? []) as EmployeeIdRow[]).map((row) => row.id)
    ),
    level2ActionEmployeeIds: uniqueIds(
      ((level3Employees.data ?? []) as EmployeeIdRow[]).map((row) => row.id)
    ),
    level1ViewOnlyEmployeeIds: isZbh
      ? uniqueIds(
          ((level2Employees.data ?? []) as EmployeeIdRow[]).map((row) => row.id)
        )
      : [],
  }
}
