import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  FinanceFilterOption,
  FinanceFilterOptions,
  FinanceFilters,
} from '@/features/finance/types'
import { hasFinanceClaimFilters } from '@/features/finance/utils/filters'
import { WORK_LOCATION_FILTER_VALUES } from '@/features/claims/types'

type ClaimFilterScope = {
  requiredStatus?: string
}

function toLikePattern(value: string): string {
  const escaped = value.replaceAll('%', '\\%').replaceAll('_', '\\_')
  return `%${escaped}%`
}

function addAcronymSuffix(designation: string): string {
  if (designation === 'State Business Head') {
    return 'State Business Head (SBH)'
  }

  if (designation === 'Zonal Business Head') {
    return 'Zonal Business Head (ZBH)'
  }

  if (designation === 'Program Manager') {
    return 'Program Manager (PM)'
  }

  return designation
}

export async function getFilteredClaimIdsForFinance(
  supabase: SupabaseClient,
  filters: FinanceFilters,
  scope: ClaimFilterScope = {}
): Promise<string[] | null> {
  if (!hasFinanceClaimFilters(filters)) {
    return null
  }

  let query = supabase
    .from('expense_claims')
    .select('id, employees!inner(employee_name, designation)')

  if (
    scope.requiredStatus &&
    filters.claimStatus &&
    filters.claimStatus !== scope.requiredStatus
  ) {
    return []
  }

  if (scope.requiredStatus) {
    query = query.eq('status', scope.requiredStatus)
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
    query = query.eq('employees.designation', filters.ownerDesignation)
  }

  if (filters.claimDateFrom) {
    query = query.gte('claim_date', filters.claimDateFrom)
  }

  if (filters.claimDateTo) {
    query = query.lte('claim_date', filters.claimDateTo)
  }

  if (filters.claimStatus) {
    query = query.eq('status', filters.claimStatus)
  }

  if (filters.workLocation) {
    query = query.eq('work_location', filters.workLocation)
  }

  if (filters.resubmittedOnly) {
    query = query.gt('resubmission_count', 0)
  }

  if (filters.hodApproverEmail) {
    const { data: hodRows, error: hodError } = await supabase
      .from('claim_status_audit')
      .select('claim_id')
      .eq('actor_scope', 'approver')
      .eq('trigger_action', 'approved')
      .eq('to_status', 'finance_review')
      .eq('actor_email', filters.hodApproverEmail)

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
  const [designationResult, hodAuditResult, statusResult] = await Promise.all([
    supabase.from('employees').select('designation'),
    supabase
      .from('claim_status_audit')
      .select('actor_email')
      .eq('actor_scope', 'approver')
      .eq('trigger_action', 'approved')
      .eq('to_status', 'finance_review'),
    supabase
      .from('claim_status_catalog')
      .select('status, display_label')
      .order('sort_order', { ascending: true }),
  ])

  if (designationResult.error) {
    throw new Error(designationResult.error.message)
  }

  if (hodAuditResult.error) {
    throw new Error(hodAuditResult.error.message)
  }

  if (statusResult.error) {
    throw new Error(statusResult.error.message)
  }

  const designationOptions: FinanceFilterOption[] = [
    ...new Set(
      (designationResult.data ?? [])
        .map((row) => row.designation)
        .filter((designation): designation is string => Boolean(designation))
    ),
  ]
    .sort((left, right) => left.localeCompare(right))
    .map((designation) => ({
      value: designation,
      label: addAcronymSuffix(designation),
    }))

  const hodEmails = [
    ...new Set(
      (hodAuditResult.data ?? [])
        .map((row) => row.actor_email?.toLowerCase() ?? '')
        .filter((email) => email.length > 0)
    ),
  ]

  const claimStatuses: FinanceFilterOption[] = (statusResult.data ?? []).map(
    (status) => ({
      value: status.status,
      label: status.display_label,
    })
  )

  const workLocations: FinanceFilterOption[] = WORK_LOCATION_FILTER_VALUES.map(
    (workLocation) => ({
      value: workLocation,
      label: workLocation,
    })
  )

  if (hodEmails.length === 0) {
    return {
      ownerDesignations: designationOptions,
      hodApprovers: [],
      claimStatuses,
      workLocations,
    }
  }

  const { data: hodEmployeeRows, error: hodEmployeeError } = await supabase
    .from('employees')
    .select('employee_email, employee_name, designation')
    .in('employee_email', hodEmails)

  if (hodEmployeeError) {
    throw new Error(hodEmployeeError.message)
  }

  const employeeMap = new Map(
    (hodEmployeeRows ?? []).map((row) => [
      row.employee_email.toLowerCase(),
      row,
    ])
  )

  const hodApproverOptions: FinanceFilterOption[] = hodEmails
    .map((email) => {
      const matched = employeeMap.get(email)

      if (!matched) {
        return {
          value: email,
          label: email,
        }
      }

      return {
        value: email,
        label: `${matched.employee_name} (${addAcronymSuffix(matched.designation)})`,
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
