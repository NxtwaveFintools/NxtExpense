import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  FinanceFilterOption,
  FinanceFilterOptions,
  FinanceFilters,
} from '@/features/finance/types'
import {
  hasFinanceClaimFilters,
  toIstDayEnd,
  toIstDayStart,
} from '@/features/finance/utils/filters'
import {
  getAllDesignations,
  getAllWorkLocations,
} from '@/lib/services/config-service'
import {
  getClaimStatusDisplayLabel,
  VISIBLE_CLAIM_STATUS_CODES,
} from '@/lib/utils/claim-status'

type ClaimFilterScope = {
  /** Pre-fetched UUID of the status that results must be constrained to. */
  requiredStatusId?: string
}

function toLikePattern(value: string): string {
  const escaped = value.replaceAll('%', '\\%').replaceAll('_', '\\_')
  return `%${escaped}%`
}

function formatDesignationLabel(name: string, abbreviation: string): string {
  return abbreviation ? `${name} (${abbreviation})` : name
}

export async function getFilteredClaimIdsForFinance(
  supabase: SupabaseClient,
  filters: FinanceFilters,
  scope: ClaimFilterScope = {}
): Promise<string[] | null> {
  if (!hasFinanceClaimFilters(filters)) {
    return null
  }

  if (scope.requiredStatusId && filters.claimStatus) {
    // If the caller requires a specific status UUID, check whether the user's
    // selected status filter resolves to that same UUID.
    const { data: sRow } = await supabase
      .from('claim_statuses')
      .select('id')
      .eq('status_code', filters.claimStatus)
      .maybeSingle()
    if (!sRow || sRow.id !== scope.requiredStatusId) {
      return []
    }
  }

  // Determine effective status UUID to filter by.
  // scope.requiredStatusId (pre-fetched) takes precedence over user's claimStatus.
  let statusId: string | null = scope.requiredStatusId ?? null
  if (!statusId && filters.claimStatus) {
    const { data: sRow } = await supabase
      .from('claim_statuses')
      .select('id')
      .eq('status_code', filters.claimStatus)
      .maybeSingle()
    if (sRow) {
      statusId = sRow.id
    } else {
      return []
    }
  }

  let query = supabase
    .from('expense_claims')
    .select('id, employees!employee_id!inner(employee_name, designation_id)')

  if (statusId) {
    query = query.eq('status_id', statusId)
  }

  if (filters.employeeName) {
    query = query.ilike(
      'employees.employee_name',
      toLikePattern(filters.employeeName)
    )
  }

  if (filters.claimNumber) {
    query = query.eq('claim_number', filters.claimNumber)
  }

  if (filters.ownerDesignation) {
    query = query.eq('employees.designation_id', filters.ownerDesignation)
  }

  if (filters.dateFilterField === 'claim_date') {
    if (filters.dateFrom) {
      query = query.gte('claim_date', filters.dateFrom)
    }

    if (filters.dateTo) {
      query = query.lte('claim_date', filters.dateTo)
    }
  }

  if (
    filters.dateFilterField === 'finance_approved_date' &&
    (filters.dateFrom || filters.dateTo)
  ) {
    let financeDateQuery = supabase
      .from('finance_actions')
      .select('claim_id')
      .eq('action', 'issued')

    const approvedDateFrom = toIstDayStart(filters.dateFrom)
    const approvedDateTo = toIstDayEnd(filters.dateTo)

    if (approvedDateFrom) {
      financeDateQuery = financeDateQuery.gte('acted_at', approvedDateFrom)
    }

    if (approvedDateTo) {
      financeDateQuery = financeDateQuery.lte('acted_at', approvedDateTo)
    }

    const { data: approvedRows, error: approvedError } = await financeDateQuery

    if (approvedError) {
      throw new Error(approvedError.message)
    }

    const approvedClaimIds = [
      ...new Set((approvedRows ?? []).map((row) => row.claim_id)),
    ]

    if (approvedClaimIds.length === 0) {
      return []
    }

    query = query.in('id', approvedClaimIds)
  }

  if (filters.workLocation) {
    query = query.eq('work_location_id', filters.workLocation)
  }

  if (filters.hodApproverEmployeeId) {
    const { data: financeReviewStatus } = await supabase
      .from('claim_statuses')
      .select('id')
      .eq('approval_level', 3)
      .eq('is_approval', false)
      .eq('is_rejection', false)
      .eq('is_terminal', false)
      .maybeSingle()

    if (!financeReviewStatus) {
      return []
    }

    const { data: hodRows, error: hodError } = await supabase
      .from('approval_history')
      .select('claim_id')
      .eq('approver_employee_id', filters.hodApproverEmployeeId)
      .eq('action', 'approved')
      .eq('new_status_id', financeReviewStatus.id)

    if (hodError) {
      throw new Error(hodError.message)
    }

    const hodClaimIds = [...new Set((hodRows ?? []).map((row) => row.claim_id))]

    if (hodClaimIds.length === 0) {
      return []
    }

    query = query.in('id', hodClaimIds)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return [...new Set((data ?? []).map((row) => row.id))]
}

export async function getFinanceFilterOptions(
  supabase: SupabaseClient
): Promise<FinanceFilterOptions> {
  const { data: financeReviewStatus } = await supabase
    .from('claim_statuses')
    .select('id')
    .eq('approval_level', 3)
    .eq('is_approval', false)
    .eq('is_rejection', false)
    .eq('is_terminal', false)
    .maybeSingle()

  const [designations, workLocationRows, statusResult] = await Promise.all([
    getAllDesignations(supabase),
    getAllWorkLocations(supabase),
    supabase
      .from('claim_statuses')
      .select('status_code, status_name, display_order')
      .eq('is_active', true)
      .in('status_code', [...VISIBLE_CLAIM_STATUS_CODES])
      .order('display_order', { ascending: true }),
  ])

  if (statusResult.error) {
    throw new Error(statusResult.error.message)
  }

  const designationOptions: FinanceFilterOption[] = designations
    .sort((left, right) =>
      left.designation_name.localeCompare(right.designation_name)
    )
    .map((d) => ({
      value: d.id,
      label: formatDesignationLabel(
        d.designation_name,
        d.designation_abbreviation
      ),
    }))

  let hodEmployeeIds: string[] = []
  if (financeReviewStatus) {
    const { data: hodRows, error: hodError } = await supabase
      .from('approval_history')
      .select('approver_employee_id')
      .eq('action', 'approved')
      .eq('new_status_id', financeReviewStatus.id)
      .not('approver_employee_id', 'is', null)

    if (hodError) {
      throw new Error(hodError.message)
    }

    hodEmployeeIds = [
      ...new Set(
        (hodRows ?? [])
          .map((row) => row.approver_employee_id as string | null)
          .filter((id): id is string => Boolean(id))
      ),
    ]
  }

  const claimStatuses: FinanceFilterOption[] = (statusResult.data ?? []).map(
    (status) => ({
      value: status.status_code,
      label: getClaimStatusDisplayLabel(status.status_code, status.status_name),
    })
  )

  const workLocations: FinanceFilterOption[] = workLocationRows.map((wl) => ({
    value: wl.id,
    label: wl.location_name,
  }))

  if (hodEmployeeIds.length === 0) {
    return {
      ownerDesignations: designationOptions,
      hodApprovers: [],
      claimStatuses,
      workLocations,
    }
  }

  const { data: hodEmployeeRows, error: hodEmployeeError } = await supabase
    .from('employees')
    .select('id, employee_name, designation_id')
    .in('id', hodEmployeeIds)

  if (hodEmployeeError) {
    throw new Error(hodEmployeeError.message)
  }

  const employeeMap = new Map(
    (hodEmployeeRows ?? []).map((row) => [row.id, row])
  )

  const designationMap = new Map(designations.map((d) => [d.id, d]))

  const hodApproverOptions: FinanceFilterOption[] = hodEmployeeIds
    .map((employeeId) => {
      const matched = employeeMap.get(employeeId)

      if (!matched) {
        return {
          value: employeeId,
          label: employeeId,
        }
      }

      const desig = matched.designation_id
        ? designationMap.get(matched.designation_id)
        : null
      const designationLabel = desig
        ? formatDesignationLabel(
            desig.designation_name,
            desig.designation_abbreviation
          )
        : ''

      return {
        value: employeeId,
        label: designationLabel
          ? `${matched.employee_name} (${designationLabel})`
          : matched.employee_name,
      }
    })
    .sort((left, right) => left.label.localeCompare(right.label))

  return {
    ownerDesignations: designationOptions,
    hodApprovers: hodApproverOptions,
    claimStatuses,
    workLocations,
  }
}
