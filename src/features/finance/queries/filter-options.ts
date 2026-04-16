import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  FinanceFilterOption,
  FinanceFilterOptions,
} from '@/features/finance/types'
import {
  getAllDesignations,
  getAllWorkLocations,
} from '@/lib/services/config-service'
import { buildClaimStatusFilterOptions } from '@/lib/utils/claim-status-filter'
import {
  hasRejectFinanceActionCode,
  REJECTED_ALLOW_RECLAIM_ACTION_FILTER_LABEL,
  REJECTED_ALLOW_RECLAIM_ACTION_FILTER_VALUE,
} from '@/features/finance/utils/action-filter'

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

function formatFinanceActionLabel(actionCode: string): string {
  return toTitleCaseWords(actionCode)
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
        .limit(200),
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
      .limit(200)

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

  type ClaimStatusFilterRow = {
    id: string
    status_code: string
    status_name: string
    allow_resubmit_status_name: string | null
  }

  const statusFilterOptions = buildClaimStatusFilterOptions(
    (statusResult.data ?? []) as ClaimStatusFilterRow[]
  )

  const claimStatuses: FinanceFilterOption[] = statusFilterOptions.map(
    (option) => ({
      value: option.value,
      label: option.label,
    })
  )

  const workLocations: FinanceFilterOption[] = workLocationRows.map((wl) => ({
    value: wl.id,
    label: wl.location_name,
  }))

  const financeActionCodes = [
    ...new Set(
      (financeActionResult.data ?? []).map((row) => row.action as string)
    ),
  ]

  const financeActions: FinanceFilterOption[] = financeActionCodes.map(
    (code) => ({
      value: code,
      label: formatFinanceActionLabel(code),
    })
  )

  if (hasRejectFinanceActionCode(financeActionCodes)) {
    financeActions.push({
      value: REJECTED_ALLOW_RECLAIM_ACTION_FILTER_VALUE,
      label: REJECTED_ALLOW_RECLAIM_ACTION_FILTER_LABEL,
    })
  }

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
