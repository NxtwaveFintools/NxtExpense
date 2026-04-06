'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getEmployeeByEmail } from '@/lib/services/employee-service'
import { isFinanceTeamMember } from '@/features/finance/permissions'
import {
  getAllDesignations,
  getAllStates,
  getAllVehicleTypes,
  getAllWorkLocations,
} from '@/lib/services/config-service'
import { getScopedEmployeeNameSuggestions } from '@/lib/services/employee-name-suggestions-service'
import { financeDashboardFilterSchema } from '@/features/dashboard/validations/finance-dashboard'
import type {
  FinanceDashboardData,
  FinanceDashboardFilterOptions,
} from '@/features/dashboard/types/finance-dashboard'
import type { FinanceDashboardFilterInput } from '@/features/dashboard/validations/finance-dashboard'

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

const FINANCE_RPC_SIGNATURE_DRIFT_PATTERN =
  /p_claim_id|p_date_filter_field|function .* does not exist|best candidate function/i

async function requireFinanceContext() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    throw new Error('Unauthorized request.')
  }

  const employee = await getEmployeeByEmail(supabase, user.email)
  if (!employee || !(await isFinanceTeamMember(supabase, employee))) {
    throw new Error('Finance access is required.')
  }

  return { supabase }
}

export async function getFinanceDashboardAnalytics(
  rawFilters: FinanceDashboardFilterInput
): Promise<ActionResult<FinanceDashboardData>> {
  const parsed = financeDashboardFilterSchema.safeParse(rawFilters)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid filter parameters.' }
  }

  try {
    const { supabase } = await requireFinanceContext()
    const filters = parsed.data

    const baseArgs = {
      p_date_from: filters.dateFrom ?? null,
      p_date_to: filters.dateTo ?? null,
      p_designation_id: filters.designationId ?? null,
      p_work_location_id: filters.workLocationId ?? null,
      p_state_id: filters.stateId ?? null,
      p_employee_id: filters.employeeId ?? null,
      p_employee_name: filters.employeeName ?? null,
      p_vehicle_code: filters.vehicleCode ?? null,
    }

    const newestArgs = {
      ...baseArgs,
      p_claim_id: null,
      p_date_filter_field: filters.dateFilterField,
    }

    const midArgs = {
      p_date_from: filters.dateFrom ?? null,
      p_date_to: filters.dateTo ?? null,
      p_designation_id: filters.designationId ?? null,
      p_work_location_id: filters.workLocationId ?? null,
      p_state_id: filters.stateId ?? null,
      p_employee_id: filters.employeeId ?? null,
      p_employee_name: filters.employeeName ?? null,
      p_vehicle_code: filters.vehicleCode ?? null,
      p_date_filter_field: filters.dateFilterField,
    }

    const oldestArgs = {
      p_date_from: filters.dateFrom ?? null,
      p_date_to: filters.dateTo ?? null,
      p_designation_id: filters.designationId ?? null,
      p_work_location_id: filters.workLocationId ?? null,
      p_state_id: filters.stateId ?? null,
      p_employee_id: filters.employeeId ?? null,
      p_employee_name: filters.employeeName ?? null,
      p_vehicle_code: filters.vehicleCode ?? null,
    }

    let { data, error } = await supabase.rpc(
      'get_finance_pending_dashboard_analytics',
      newestArgs
    )

    if (error && FINANCE_RPC_SIGNATURE_DRIFT_PATTERN.test(error.message)) {
      const fallback = await supabase.rpc(
        'get_finance_pending_dashboard_analytics',
        midArgs
      )
      data = fallback.data
      error = fallback.error
    }

    if (error && FINANCE_RPC_SIGNATURE_DRIFT_PATTERN.test(error.message)) {
      const fallback = await supabase.rpc(
        'get_finance_pending_dashboard_analytics',
        oldestArgs
      )
      data = fallback.data
      error = fallback.error
    }

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true, data: data as FinanceDashboardData }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error.'
    return { ok: false, error: message }
  }
}

export async function getFinanceDashboardFilterOptions(): Promise<
  ActionResult<FinanceDashboardFilterOptions>
> {
  try {
    const { supabase } = await requireFinanceContext()

    const [designations, vehicleTypes, workLocations, states] =
      await Promise.all([
        getAllDesignations(supabase),
        getAllVehicleTypes(supabase),
        getAllWorkLocations(supabase),
        getAllStates(supabase),
      ])

    return {
      ok: true,
      data: {
        designations: designations.map((d) => ({
          value: d.id,
          label: d.designation_name,
        })),
        vehicleTypes: vehicleTypes.map((v) => ({
          value: v.vehicle_code,
          label: v.vehicle_name,
        })),
        workLocations: workLocations.map((w) => ({
          value: w.id,
          label: w.location_name,
        })),
        states: states.map((s) => ({
          value: s.id,
          label: s.state_name,
        })),
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error.'
    return { ok: false, error: message }
  }
}

export async function getFinanceDashboardEmployeeNameSuggestions(
  employeeNameSearch: string | null
): Promise<ActionResult<string[]>> {
  try {
    const { supabase } = await requireFinanceContext()
    const names = await getScopedEmployeeNameSuggestions(
      supabase,
      employeeNameSearch,
      8
    )

    return { ok: true, data: names }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error.'
    return { ok: false, error: message }
  }
}
