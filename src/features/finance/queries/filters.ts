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
import { getClaimStatusDisplayLabel } from '@/lib/utils/claim-status'

type ClaimFilterScope = {
  /** Pre-fetched UUID of the status that results must be constrained to. */
  requiredStatusId?: string
}

type FinanceActionTransitionRow = {
  action_code: string
  to_status_id: string
}

function toLikePattern(value: string): string {
  const escaped = value.replaceAll('%', '\\%').replaceAll('_', '\\_')
  return `%${escaped}%`
}

function formatDesignationLabel(name: string, abbreviation: string): string {
  return abbreviation ? `${name} (${abbreviation})` : name
}

function toTitleCaseWords(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}

function normalizeFinanceHistoryActionCode(
  actionCode: string,
  toStatusId: string,
  paymentIssuedStatusIds: Set<string>
): string {
  if (
    paymentIssuedStatusIds.has(toStatusId) &&
    actionCode.startsWith('finance_')
  ) {
    return actionCode.slice('finance_'.length)
  }

  return actionCode
}

function formatFinanceActionLabel(actionCode: string): string {
  return toTitleCaseWords(actionCode)
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
    if (filters.claimStatus !== scope.requiredStatusId) {
      return []
    }
  }

  // Determine effective status UUID to filter by.
  // scope.requiredStatusId (pre-fetched) takes precedence over user's claimStatus.
  const statusId = scope.requiredStatusId ?? filters.claimStatus ?? null

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
    const { data: paymentIssuedStatuses, error: paymentIssuedStatusError } =
      await supabase
        .from('claim_statuses')
        .select('id')
        .eq('is_payment_issued', true)
        .eq('is_active', true)

    if (paymentIssuedStatusError) {
      throw new Error(paymentIssuedStatusError.message)
    }

    const paymentIssuedStatusIds = new Set(
      (paymentIssuedStatuses ?? []).map((row) => row.id)
    )

    if (paymentIssuedStatusIds.size === 0) {
      return []
    }

    const { data: transitionRows, error: transitionError } = await supabase
      .from('claim_status_transitions')
      .select('action_code, to_status_id')
      .eq('is_active', true)

    if (transitionError) {
      throw new Error(transitionError.message)
    }

    const paymentIssuedActions = new Set(
      ((transitionRows ?? []) as FinanceActionTransitionRow[])
        .filter((row) => paymentIssuedStatusIds.has(row.to_status_id))
        .map((row) =>
          normalizeFinanceHistoryActionCode(
            row.action_code,
            row.to_status_id,
            paymentIssuedStatusIds
          )
        )
    )

    if (paymentIssuedActions.size === 0) {
      return []
    }

    let financeDateQuery = supabase
      .from('finance_actions')
      .select('claim_id')
      .in('action', [...paymentIssuedActions])

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

  const [designations, workLocationRows, statusResult, financeActionResult] =
    await Promise.all([
      getAllDesignations(supabase),
      getAllWorkLocations(supabase),
      supabase
        .from('claim_statuses')
        .select('id, status_code, status_name, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
      supabase
        .from('finance_actions')
        .select('action')
        .order('acted_at', { ascending: false })
        .limit(1000),
    ])

  if (statusResult.error) {
    throw new Error(statusResult.error.message)
  }

  if (financeActionResult.error) {
    throw new Error(financeActionResult.error.message)
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
      value: status.id,
      label: getClaimStatusDisplayLabel(status.status_code, status.status_name),
    })
  )

  const workLocations: FinanceFilterOption[] = workLocationRows.map((wl) => ({
    value: wl.id,
    label: wl.location_name,
  }))

  const financeActionValues = [
    ...new Set((financeActionResult.data ?? []).map((row) => row.action)),
  ].sort((left, right) => left.localeCompare(right))

  const financeActions: FinanceFilterOption[] = financeActionValues.map(
    (actionCode) => ({
      value: actionCode,
      label: formatFinanceActionLabel(actionCode),
    })
  )

  if (hodEmployeeIds.length === 0) {
    return {
      ownerDesignations: designationOptions,
      hodApprovers: [],
      claimStatuses,
      workLocations,
      financeActions,
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
    financeActions,
  }
}
