import type { SupabaseClient } from '@supabase/supabase-js'

import {
  decodeCursor,
  encodeCursor,
  type PaginatedResult,
} from '@/lib/utils/pagination'
import type {
  AdminAnalyticsClaimRow,
  AdminAnalyticsFilters,
} from '@/features/admin/types/analytics'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function sanitizeLikeValue(value: string | null): string | null {
  if (!value) {
    return null
  }

  const sanitized = value.replace(/[%_]/g, '').replace(/,/g, ' ').trim()
  return sanitized.length > 0 ? sanitized : null
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return 10
  }

  const normalized = Math.trunc(limit)
  if (normalized < 1) {
    return 10
  }

  return Math.min(normalized, 50)
}

function getNextDateIso(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function intersectIds(
  base: string[] | null,
  target: string[] | null
): string[] | null {
  if (base === null) {
    return target
  }

  if (target === null) {
    return base
  }

  const targetSet = new Set(target)
  return base.filter((id) => targetSet.has(id))
}

async function getStateFilteredEmployeeIds(
  supabase: SupabaseClient,
  stateId: string | null
): Promise<string[] | null> {
  if (!stateId) {
    return null
  }

  const { data, error } = await supabase
    .from('employee_states')
    .select('employee_id')
    .eq('state_id', stateId)

  if (error) {
    throw new Error(error.message)
  }

  const ids = Array.from(
    new Set((data ?? []).map((row) => row.employee_id).filter(Boolean))
  )

  return ids
}

async function getEmployeeSearchIds(
  supabase: SupabaseClient,
  filters: Pick<AdminAnalyticsFilters, 'employeeId' | 'employeeName'>
): Promise<string[] | null> {
  const employeeIdSearch = sanitizeLikeValue(filters.employeeId)
  const employeeNameSearch = sanitizeLikeValue(filters.employeeName)

  if (!employeeIdSearch && !employeeNameSearch) {
    return null
  }

  let query = supabase.from('employees').select('id').limit(5000)

  if (employeeIdSearch) {
    query = query.ilike('employee_id', `%${employeeIdSearch}%`)
  }

  if (employeeNameSearch) {
    query = query.ilike('employee_name', `%${employeeNameSearch}%`)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const ids = Array.from(
    new Set((data ?? []).map((row) => row.id).filter(Boolean))
  )
  return ids
}

async function resolveEmployeeIdsForFilters(
  supabase: SupabaseClient,
  filters: AdminAnalyticsFilters
): Promise<string[] | null> {
  const [stateIds, employeeSearchIds] = await Promise.all([
    getStateFilteredEmployeeIds(supabase, filters.stateId),
    getEmployeeSearchIds(supabase, {
      employeeId: filters.employeeId,
      employeeName: filters.employeeName,
    }),
  ])

  return intersectIds(stateIds, employeeSearchIds)
}

async function resolveVehicleTypeId(
  supabase: SupabaseClient,
  vehicleCode: string | null
): Promise<string | null> {
  if (!vehicleCode) {
    return null
  }

  const { data, error } = await supabase
    .from('vehicle_types')
    .select('id')
    .eq('vehicle_code', vehicleCode)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data?.id ?? null
}

async function resolvePendingStatusIds(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data, error } = await supabase
    .from('claim_statuses')
    .select('id')
    .eq('is_active', true)
    .eq('is_terminal', false)
    .eq('is_rejection', false)
    .eq('is_approval', false)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => row.id)
}

export async function getAdminAnalyticsClaimsPaginated(
  supabase: SupabaseClient,
  cursor: string | null,
  limit: number,
  filters: AdminAnalyticsFilters
): Promise<PaginatedResult<AdminAnalyticsClaimRow>> {
  const normalizedLimit = normalizeLimit(limit)

  const [employeeIds, vehicleTypeId] = await Promise.all([
    resolveEmployeeIdsForFilters(supabase, filters),
    resolveVehicleTypeId(supabase, filters.vehicleCode),
  ])

  if (employeeIds !== null && employeeIds.length === 0) {
    return {
      data: [],
      nextCursor: null,
      hasNextPage: false,
      limit: normalizedLimit,
    }
  }

  if (filters.vehicleCode && !vehicleTypeId) {
    return {
      data: [],
      nextCursor: null,
      hasNextPage: false,
      limit: normalizedLimit,
    }
  }

  let query = supabase
    .from('expense_claims')
    .select(
      `
      id,
      claim_number,
      claim_date,
      submitted_at,
      total_amount,
      status_id,
      employee_id,
      claim_statuses!status_id(status_name),
      employees!employee_id(employee_id, employee_name)
    `
    )
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(normalizedLimit + 1)

  if (filters.dateFilterField === 'travel_date') {
    if (filters.dateFrom) {
      query = query.gte('claim_date', filters.dateFrom)
    }

    if (filters.dateTo) {
      query = query.lte('claim_date', filters.dateTo)
    }
  } else {
    if (filters.dateFrom) {
      query = query.gte('submitted_at', `${filters.dateFrom}T00:00:00Z`)
    }

    if (filters.dateTo) {
      const nextDate = getNextDateIso(filters.dateTo)
      query = query.lt('submitted_at', `${nextDate}T00:00:00Z`)
    }
  }

  if (filters.designationId) {
    query = query.eq('designation_id', filters.designationId)
  }

  if (filters.workLocationId) {
    query = query.eq('work_location_id', filters.workLocationId)
  }

  if (filters.claimStatusId) {
    query = query.eq('status_id', filters.claimStatusId)
  }

  if (vehicleTypeId) {
    query = query.eq('vehicle_type_id', vehicleTypeId)
  }

  if (employeeIds) {
    query = query.in('employee_id', employeeIds)
  }

  const claimIdSearch = sanitizeLikeValue(filters.claimId)
  if (claimIdSearch) {
    if (UUID_REGEX.test(claimIdSearch)) {
      query = query.or(
        `claim_number.ilike.%${claimIdSearch}%,id.eq.${claimIdSearch}`
      )
    } else {
      query = query.ilike('claim_number', `%${claimIdSearch}%`)
    }
  }

  if (filters.pendingOnly) {
    const pendingStatusIds = await resolvePendingStatusIds(supabase)
    if (pendingStatusIds.length === 0) {
      return {
        data: [],
        nextCursor: null,
        hasNextPage: false,
        limit: normalizedLimit,
      }
    }

    query = query.in('status_id', pendingStatusIds)
  }

  if (cursor) {
    const decodedCursor = decodeCursor(cursor)
    query = query.or(
      `submitted_at.lt.${decodedCursor.created_at},and(submitted_at.eq.${decodedCursor.created_at},id.lt.${decodedCursor.id})`
    )
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as Array<{
    id: string
    claim_number: string | null
    claim_date: string
    submitted_at: string | null
    total_amount: number | string
    claim_statuses:
      | { status_name: string }
      | Array<{ status_name: string }>
      | null
    employees:
      | { employee_id: string; employee_name: string }
      | Array<{ employee_id: string; employee_name: string }>
      | null
  }>

  const hasNextPage = rows.length > normalizedLimit
  const pageRows = hasNextPage ? rows.slice(0, normalizedLimit) : rows

  const mappedRows: AdminAnalyticsClaimRow[] = pageRows.map((row) => {
    const status = Array.isArray(row.claim_statuses)
      ? row.claim_statuses[0]
      : row.claim_statuses
    const employee = Array.isArray(row.employees)
      ? row.employees[0]
      : row.employees

    return {
      claim_id: row.id,
      claim_number: row.claim_number,
      claim_date: row.claim_date,
      submitted_at: row.submitted_at,
      total_amount: Number(row.total_amount),
      status_name: status?.status_name ?? 'Unknown',
      employee_id: employee?.employee_id ?? 'NA',
      employee_name: employee?.employee_name ?? 'Unknown',
    }
  })

  const lastRow = mappedRows.at(-1)
  const nextCursor =
    hasNextPage && lastRow?.submitted_at
      ? encodeCursor({
          created_at: lastRow.submitted_at,
          id: lastRow.claim_id,
        })
      : null

  return {
    data: mappedRows,
    nextCursor,
    hasNextPage,
    limit: normalizedLimit,
  }
}
