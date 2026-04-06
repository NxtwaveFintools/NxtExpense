'use server'

import {
  getAllDesignations,
  getAllStates,
  getAllVehicleTypes,
  getAllWorkLocations,
} from '@/lib/services/config-service'
import { getAdminContext } from '@/features/admin/actions/context'
import {
  adminAnalyticsFilterSchema,
  type AdminAnalyticsFilterInput,
} from '@/features/admin/validations/analytics'
import { getScopedEmployeeNameSuggestions } from '@/lib/services/employee-name-suggestions-service'
import { getAdminAnalyticsClaimsPaginated } from '@/features/admin/queries/analytics-claims'
import type {
  AdminAnalyticsClaimsPage,
  AdminAnalyticsFilterOptions,
  AdminDashboardAnalytics,
} from '@/features/admin/types/analytics'

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

type ClaimStatusOptionRow = {
  id: string
  status_name: string
  is_active: boolean
}

const ADMIN_ANALYTICS_SIGNATURE_DRIFT_PATTERN =
  /p_claim_id|function .* does not exist/i

export async function getAdminDashboardAnalyticsAction(
  rawFilters: AdminAnalyticsFilterInput
): Promise<ActionResult<AdminDashboardAnalytics>> {
  const parsed = adminAnalyticsFilterSchema.safeParse(rawFilters)

  if (!parsed.success) {
    return { ok: false, error: 'Invalid analytics filter parameters.' }
  }

  try {
    const { supabase } = await getAdminContext()
    const filters = parsed.data

    const { data, error } = await supabase.rpc(
      'get_admin_dashboard_analytics',
      {
        p_date_filter_field: filters.dateFilterField,
        p_date_from: filters.dateFrom ?? null,
        p_date_to: filters.dateTo ?? null,
        p_claim_id: filters.claimId ?? null,
        p_designation_id: filters.designationId ?? null,
        p_work_location_id: filters.workLocationId ?? null,
        p_state_id: filters.stateId ?? null,
        p_employee_id: filters.employeeId ?? null,
        p_employee_name: filters.employeeName ?? null,
        p_vehicle_code: filters.vehicleCode ?? null,
        p_claim_status_id: filters.claimStatusId ?? null,
        p_pending_only: filters.pendingOnly,
        p_top_claims_limit: 10,
      }
    )

    if (error && ADMIN_ANALYTICS_SIGNATURE_DRIFT_PATTERN.test(error.message)) {
      const fallback = await supabase.rpc('get_admin_dashboard_analytics', {
        p_date_filter_field: filters.dateFilterField,
        p_date_from: filters.dateFrom ?? null,
        p_date_to: filters.dateTo ?? null,
        p_designation_id: filters.designationId ?? null,
        p_work_location_id: filters.workLocationId ?? null,
        p_state_id: filters.stateId ?? null,
        p_employee_id: filters.employeeId ?? null,
        p_employee_name: filters.employeeName ?? null,
        p_vehicle_code: filters.vehicleCode ?? null,
        p_claim_status_id: filters.claimStatusId ?? null,
        p_pending_only: filters.pendingOnly,
        p_top_claims_limit: 10,
      })

      if (fallback.error) {
        return { ok: false, error: fallback.error.message }
      }

      return { ok: true, data: fallback.data as AdminDashboardAnalytics }
    }

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true, data: data as AdminDashboardAnalytics }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error.'
    return { ok: false, error: message }
  }
}

export async function getAdminAnalyticsClaimsPageAction(payload: {
  filters: AdminAnalyticsFilterInput
  cursor?: string | null
  limit?: number
}): Promise<ActionResult<AdminAnalyticsClaimsPage>> {
  const parsedFilters = adminAnalyticsFilterSchema.safeParse(payload.filters)

  if (!parsedFilters.success) {
    return { ok: false, error: 'Invalid analytics filter parameters.' }
  }

  try {
    const { supabase } = await getAdminContext()
    const claimsPage = await getAdminAnalyticsClaimsPaginated(
      supabase,
      payload.cursor ?? null,
      payload.limit ?? 10,
      {
        dateFilterField: parsedFilters.data.dateFilterField,
        dateFrom: parsedFilters.data.dateFrom ?? null,
        dateTo: parsedFilters.data.dateTo ?? null,
        claimId: parsedFilters.data.claimId ?? null,
        designationId: parsedFilters.data.designationId ?? null,
        workLocationId: parsedFilters.data.workLocationId ?? null,
        stateId: parsedFilters.data.stateId ?? null,
        employeeId: parsedFilters.data.employeeId ?? null,
        employeeName: parsedFilters.data.employeeName ?? null,
        vehicleCode: parsedFilters.data.vehicleCode ?? null,
        claimStatusId: parsedFilters.data.claimStatusId ?? null,
        pendingOnly: parsedFilters.data.pendingOnly,
      }
    )

    return {
      ok: true,
      data: claimsPage,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error.'
    return { ok: false, error: message }
  }
}

export async function getAdminAnalyticsFilterOptionsAction(): Promise<
  ActionResult<AdminAnalyticsFilterOptions>
> {
  try {
    const { supabase } = await getAdminContext()

    const [designations, workLocations, states, vehicleTypes, claimStatuses] =
      await Promise.all([
        getAllDesignations(supabase),
        getAllWorkLocations(supabase),
        getAllStates(supabase),
        getAllVehicleTypes(supabase),
        supabase
          .from('claim_statuses')
          .select('id, status_name, is_active')
          .eq('is_active', true)
          .order('display_order', { ascending: true }),
      ])

    if (claimStatuses.error) {
      return { ok: false, error: claimStatuses.error.message }
    }

    return {
      ok: true,
      data: {
        designations: designations.map((item) => ({
          value: item.id,
          label: item.designation_name,
        })),
        workLocations: workLocations.map((item) => ({
          value: item.id,
          label: item.location_name,
        })),
        states: states.map((item) => ({
          value: item.id,
          label: item.state_name,
        })),
        vehicleTypes: vehicleTypes.map((item) => ({
          value: item.vehicle_code,
          label: item.vehicle_name,
        })),
        claimStatuses: (
          (claimStatuses.data ?? []) as ClaimStatusOptionRow[]
        ).map((item) => ({
          value: item.id,
          label: item.status_name,
        })),
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error.'
    return { ok: false, error: message }
  }
}

export async function getAdminAnalyticsEmployeeNameSuggestionsAction(
  employeeNameSearch: string | null
): Promise<ActionResult<string[]>> {
  try {
    const { supabase } = await getAdminContext()
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
