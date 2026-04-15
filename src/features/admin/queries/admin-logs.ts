import type { SupabaseClient } from '@supabase/supabase-js'

import {
  decodeCursor,
  encodeCursor,
  type PaginatedResult,
} from '@/lib/utils/pagination'

type AdminLogRow = {
  id: string
  admin_id: string
  action_type: string
  entity_type: string
  entity_id: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
  admin_name: string
  admin_email: string
}

type AdminLogFilters = {
  actionType: string | null
  entityType: string | null
  search: string | null
}

type AdminLogFilterOptions = {
  actionTypes: string[]
  entityTypes: string[]
}

function sanitizeSearchInput(value: string | null): string | null {
  if (!value) {
    return null
  }

  const sanitized = value.replace(/[%_]/g, '').replace(/,/g, ' ').trim()
  return sanitized.length > 0 ? sanitized : null
}

export async function getAdminLogFilterOptions(
  supabase: SupabaseClient
): Promise<AdminLogFilterOptions> {
  const [actionRowsResult, entityRowsResult] = await Promise.all([
    supabase
      .from('admin_logs')
      .select('action_type')
      .order('action_type')
      .limit(200),
    supabase
      .from('admin_logs')
      .select('entity_type')
      .order('entity_type')
      .limit(200),
  ])

  const queryError = actionRowsResult.error ?? entityRowsResult.error

  if (queryError) {
    throw new Error(queryError.message)
  }

  const actionTypes = Array.from(
    new Set((actionRowsResult.data ?? []).map((row) => row.action_type))
  )
  const entityTypes = Array.from(
    new Set((entityRowsResult.data ?? []).map((row) => row.entity_type))
  )

  return {
    actionTypes,
    entityTypes,
  }
}

export async function getAdminLogsPaginated(
  supabase: SupabaseClient,
  cursor: string | null,
  limit: number,
  filters: AdminLogFilters
): Promise<PaginatedResult<AdminLogRow>> {
  let query = supabase
    .from('admin_logs')
    .select(
      'id, admin_id, action_type, entity_type, entity_id, old_value, new_value, created_at, employees!admin_id(employee_name, employee_email)'
    )
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  if (filters.actionType) {
    query = query.eq('action_type', filters.actionType)
  }

  if (filters.entityType) {
    query = query.eq('entity_type', filters.entityType)
  }

  const sanitizedSearch = sanitizeSearchInput(filters.search)

  if (sanitizedSearch) {
    query = query.or(
      `action_type.ilike.%${sanitizedSearch}%,entity_type.ilike.%${sanitizedSearch}%`
    )
  }

  if (cursor) {
    const decoded = decodeCursor(cursor)
    query = query.or(
      `created_at.lt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`
    )
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as Array<
    Record<string, unknown> & {
      employees:
        | { employee_name: string; employee_email: string }
        | Array<{ employee_name: string; employee_email: string }>
        | null
    }
  >

  const hasNextPage = rows.length > limit
  const pageRows = hasNextPage ? rows.slice(0, limit) : rows

  const mappedRows = pageRows.map((row) => {
    const actor = Array.isArray(row.employees)
      ? row.employees[0]
      : row.employees

    return {
      id: row.id as string,
      admin_id: row.admin_id as string,
      action_type: row.action_type as string,
      entity_type: row.entity_type as string,
      entity_id: (row.entity_id as string | null) ?? null,
      old_value: (row.old_value as Record<string, unknown> | null) ?? null,
      new_value: (row.new_value as Record<string, unknown> | null) ?? null,
      created_at: row.created_at as string,
      admin_name: actor?.employee_name ?? 'Unknown',
      admin_email: actor?.employee_email ?? '-',
    }
  })

  const lastRow = pageRows.at(-1)
  const nextCursor =
    hasNextPage && lastRow
      ? encodeCursor({
          created_at: lastRow.created_at as string,
          id: lastRow.id as string,
        })
      : null

  return {
    data: mappedRows,
    hasNextPage,
    nextCursor,
    limit,
  }
}
