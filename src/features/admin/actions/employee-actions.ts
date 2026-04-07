'use server'

import { adminPrepareReplacementSchema } from '@/features/admin/validations'
import type {
  AdminCreateEmployeeResult,
  AdminEmployeeFormOptions,
} from '@/features/admin/types'

import { createEmployeeAction as createEmployeeActionCore } from '@/features/admin/actions/employee-create-action'
import { getAdminContext } from '@/features/admin/actions/context'

type PrepareReplacementResult = {
  ok: boolean
  error: string | null
  data: {
    oldEmployeeId: string
    oldEmployeeName: string
    defaultDesignationId: string | null
    defaultRoleId: string | null
    defaultStateId: string | null
    reason: string
  } | null
}

export async function createEmployeeAction(
  payload: unknown
): Promise<AdminCreateEmployeeResult> {
  return createEmployeeActionCore(payload)
}

export async function prepareEmployeeReplacementAction(payload: {
  employeeId: string
  reason: string
  confirmation: 'CONFIRM'
}): Promise<PrepareReplacementResult> {
  const parsed = adminPrepareReplacementSchema.safeParse(payload)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid replacement input.',
      data: null,
    }
  }

  try {
    const { supabase } = await getAdminContext()

    const { data, error } = await supabase.rpc(
      'admin_prepare_employee_replacement_atomic',
      {
        p_employee_id: parsed.data.employeeId,
        p_reason: parsed.data.reason,
        p_confirmation: parsed.data.confirmation,
      }
    )

    if (error) {
      throw new Error(error.message)
    }

    const row = Array.isArray(data) ? data[0] : null

    return {
      ok: true,
      error: null,
      data: row
        ? {
            oldEmployeeId: row.old_employee_id,
            oldEmployeeName: row.old_employee_name,
            defaultDesignationId: row.default_designation_id,
            defaultRoleId: row.default_role_id,
            defaultStateId: row.default_state_id,
            reason: parsed.data.reason,
          }
        : null,
    }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unable to prepare employee replacement.',
      data: null,
    }
  }
}

export async function getEmployeeFormOptionsAction(): Promise<{
  ok: boolean
  error: string | null
  data: AdminEmployeeFormOptions | null
}> {
  try {
    const { supabase } = await getAdminContext()

    const [designationsResult, statusesResult, rolesResult, statesResult] =
      await Promise.all([
        supabase
          .from('designations')
          .select('id, designation_name, designation_code')
          .eq('is_active', true)
          .order('hierarchy_level'),
        supabase
          .from('employee_statuses')
          .select('id, status_name, status_code')
          .order('display_order'),
        supabase
          .from('roles')
          .select('id, role_name, role_code')
          .eq('is_active', true)
          .order('role_name'),
        supabase
          .from('states')
          .select('id, state_name, state_code')
          .eq('is_active', true)
          .order('state_name'),
      ])

    const { data: approverRules, error: approverRulesError } = await supabase
      .from('approver_selection_rules')
      .select(
        'approval_level, designations!designation_id(designation_name), is_active'
      )
      .eq('is_active', true)

    const queryError =
      designationsResult.error ??
      statusesResult.error ??
      rolesResult.error ??
      statesResult.error ??
      approverRulesError

    if (queryError) {
      throw new Error(queryError.message)
    }

    const ruleLabelsByLevel = {
      level1: [] as string[],
      level2: [] as string[],
      level3: [] as string[],
    }

    for (const row of approverRules ?? []) {
      const designation = row.designations as
        | { designation_name: string }
        | Array<{ designation_name: string }>
        | null
        | undefined
      const resolvedDesignation = Array.isArray(designation)
        ? designation[0]
        : designation

      const label = resolvedDesignation?.designation_name
      if (!label) {
        continue
      }

      if (row.approval_level === 1) {
        ruleLabelsByLevel.level1.push(label)
      }

      if (row.approval_level === 2) {
        ruleLabelsByLevel.level2.push(label)
      }

      if (row.approval_level === 3) {
        ruleLabelsByLevel.level3.push(label)
      }
    }

    return {
      ok: true,
      error: null,
      data: {
        designations: designationsResult.data ?? [],
        statuses: statusesResult.data ?? [],
        roles: rolesResult.data ?? [],
        states: statesResult.data ?? [],
        approversByLevel: {
          level1: [],
          level2: [],
          level3: [],
        },
        approverRuleLabelsByLevel: ruleLabelsByLevel,
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to load options.',
      data: null,
    }
  }
}

export async function getApproverOptionsByStateAction(
  stateId: string
): Promise<{
  ok: boolean
  error: string | null
  data: AdminEmployeeFormOptions['approversByLevel'] | null
}> {
  try {
    const { supabase } = await getAdminContext()

    const { data, error } = await supabase.rpc(
      'get_admin_approver_options_by_state',
      {
        p_state_id: stateId,
      }
    )

    if (error) {
      throw new Error(error.message)
    }

    const rows = (data ?? []) as Array<{
      approval_level: number
      employee_id: string
      employee_name: string
      employee_email: string
    }>

    const byLevel: AdminEmployeeFormOptions['approversByLevel'] = {
      level1: [],
      level2: [],
      level3: [],
    }

    for (const row of rows) {
      const entry = {
        id: row.employee_id,
        employee_name: row.employee_name,
        employee_email: row.employee_email,
      }

      if (row.approval_level === 1) {
        byLevel.level1.push(entry)
      }

      if (row.approval_level === 2) {
        byLevel.level2.push(entry)
      }

      if (row.approval_level === 3) {
        byLevel.level3.push(entry)
      }
    }

    return {
      ok: true,
      error: null,
      data: byLevel,
    }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to load approver options.',
      data: null,
    }
  }
}
