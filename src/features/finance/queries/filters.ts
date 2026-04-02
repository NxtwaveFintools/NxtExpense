import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  FinanceDateFilterField,
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
  buildClaimStatusFilterOptions,
  parseClaimStatusFilterValue,
} from '@/lib/utils/claim-status-filter'

type ClaimFilterScope = {
  /** Pre-fetched UUID of the status that results must be constrained to. */
  requiredStatusId?: string
}

type FinanceActionTransitionRow = {
  action_code: string
  to_status_id: string
}

type ClaimStatusFilterRow = {
  id: string
  status_code: string
  status_name: string
  allow_resubmit_status_name: string | null
}

type ClaimStatusIdRow = {
  id: string
}

export type FinanceActionDateFilterField = Extract<
  FinanceDateFilterField,
  'finance_approved_date' | 'payment_released_date'
>

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

export function isFinanceActionDateFilterField(
  field: FinanceDateFilterField
): field is FinanceActionDateFilterField {
  return field === 'finance_approved_date' || field === 'payment_released_date'
}

async function getFinanceApprovedStatusIds(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const { data: statuses, error } = await supabase
    .from('claim_statuses')
    .select('id')
    .eq('is_active', true)
    .eq('is_approval', true)
    .eq('is_rejection', false)
    .eq('is_terminal', false)
    .eq('is_payment_issued', false)
    .is('approval_level', null)

  if (error) {
    throw new Error(error.message)
  }

  return new Set((statuses ?? []).map((row) => (row as ClaimStatusIdRow).id))
}

async function getPaymentReleasedStatusIds(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const { data: statuses, error } = await supabase
    .from('claim_statuses')
    .select('id')
    .eq('is_payment_issued', true)
    .eq('is_active', true)

  if (error) {
    throw new Error(error.message)
  }

  return new Set((statuses ?? []).map((row) => (row as ClaimStatusIdRow).id))
}

async function getDateFilterTargetStatusIds(
  supabase: SupabaseClient,
  dateFilterField: FinanceActionDateFilterField
): Promise<Set<string>> {
  return dateFilterField === 'finance_approved_date'
    ? getFinanceApprovedStatusIds(supabase)
    : getPaymentReleasedStatusIds(supabase)
}

export async function getFinanceActionCodesForDateFilter(
  supabase: SupabaseClient,
  dateFilterField: FinanceActionDateFilterField,
  targetStatusIds?: Set<string>
): Promise<string[]> {
  const resolvedStatusIds =
    targetStatusIds ??
    (await getDateFilterTargetStatusIds(supabase, dateFilterField))

  if (resolvedStatusIds.size === 0) {
    return []
  }

  const { data: transitionRows, error: transitionError } = await supabase
    .from('claim_status_transitions')
    .select('action_code, to_status_id')
    .eq('is_active', true)
    .in('to_status_id', [...resolvedStatusIds])

  if (transitionError) {
    throw new Error(transitionError.message)
  }

  return [
    ...new Set(
      ((transitionRows ?? []) as FinanceActionTransitionRow[]).map((row) =>
        dateFilterField === 'payment_released_date'
          ? normalizeFinanceHistoryActionCode(
              row.action_code,
              row.to_status_id,
              resolvedStatusIds
            )
          : row.action_code
      )
    ),
  ]
}

export async function getFilteredClaimIdsForFinance(
  supabase: SupabaseClient,
  filters: FinanceFilters,
  scope: ClaimFilterScope = {}
): Promise<string[] | null> {
  if (!hasFinanceClaimFilters(filters)) {
    return null
  }

  const parsedStatusFilter = parseClaimStatusFilterValue(filters.claimStatus)
  const allowResubmitOnlyStatusFilter =
    parsedStatusFilter?.allowResubmitOnly ?? false

  if (scope.requiredStatusId && filters.claimStatus) {
    if (
      !parsedStatusFilter ||
      allowResubmitOnlyStatusFilter ||
      parsedStatusFilter.statusId !== scope.requiredStatusId
    ) {
      return []
    }
  }

  // Determine effective status UUID to filter by.
  // scope.requiredStatusId (pre-fetched) takes precedence over user's claimStatus.
  const statusId =
    scope.requiredStatusId ?? parsedStatusFilter?.statusId ?? null

  let query = supabase
    .from('expense_claims')
    .select('id, employees!employee_id!inner(employee_name, designation_id)')

  if (statusId) {
    query = query.eq('status_id', statusId)
  }

  if (allowResubmitOnlyStatusFilter) {
    query = query.eq('allow_resubmit', true)
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

  if (filters.dateFilterField === 'submitted_at') {
    const submittedDateFrom = toIstDayStart(filters.dateFrom)
    const submittedDateTo = toIstDayEnd(filters.dateTo)

    if (submittedDateFrom) {
      query = query.gte('submitted_at', submittedDateFrom)
    }

    if (submittedDateTo) {
      query = query.lte('submitted_at', submittedDateTo)
    }
  }

  const filterByFinanceActionDate =
    isFinanceActionDateFilterField(filters.dateFilterField) &&
    (filters.dateFrom || filters.dateTo)

  if (filterByFinanceActionDate) {
    const dateFilterStatusIds = await getDateFilterTargetStatusIds(
      supabase,
      filters.dateFilterField
    )

    if (dateFilterStatusIds.size === 0) {
      return []
    }

    // Date filter fields are milestone-specific and must only return claims
    // that are currently in the corresponding status bucket.
    query = query.in('status_id', [...dateFilterStatusIds])

    const dateFilterActions = await getFinanceActionCodesForDateFilter(
      supabase,
      filters.dateFilterField,
      dateFilterStatusIds
    )

    if (dateFilterActions.length === 0) {
      return []
    }

    let financeDateQuery = supabase
      .from('finance_actions')
      .select('claim_id')
      .in('action', dateFilterActions)

    const dateFrom = toIstDayStart(filters.dateFrom)
    const dateTo = toIstDayEnd(filters.dateTo)

    if (dateFrom) {
      financeDateQuery = financeDateQuery.gte('acted_at', dateFrom)
    }

    if (dateTo) {
      financeDateQuery = financeDateQuery.lte('acted_at', dateTo)
    }

    const { data: financeDateRows, error: financeDateError } =
      await financeDateQuery

    if (financeDateError) {
      throw new Error(financeDateError.message)
    }

    const financeDateClaimIds = [
      ...new Set((financeDateRows ?? []).map((row) => row.claim_id)),
    ]

    if (financeDateClaimIds.length === 0) {
      return []
    }

    query = query.in('id', financeDateClaimIds)
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
        .select(
          'id, status_code, status_name, display_order, allow_resubmit_status_name'
        )
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

  const claimStatuses: FinanceFilterOption[] = buildClaimStatusFilterOptions(
    (statusResult.data ?? []) as ClaimStatusFilterRow[]
  ).map((option) => ({
    value: option.value,
    label: option.label,
  }))

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
