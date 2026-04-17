import type { FinanceFilters, FinanceOwner } from '@/features/finance/types'

export const DEFAULT_FINANCE_FILTERS: FinanceFilters = {
  employeeId: null,
  employeeName: null,
  claimNumber: null,
  ownerDesignation: null,
  hodApproverEmployeeId: null,
  claimStatus: null,
  workLocation: null,
  actionFilter: null,
  dateFilterField: 'claim_date',
  dateFrom: null,
  dateTo: null,
}

export const FINANCE_OWNER_COLUMNS =
  'id, employee_id, employee_name, employee_email, designation_id, designations!designation_id(designation_name)'

type FinanceOwnerRelationRow = Omit<FinanceOwner, 'designations'> & {
  designations:
    | FinanceOwner['designations']
    | Array<NonNullable<FinanceOwner['designations']>>
}

export type ExpenseClaimWithOwnerRow = Record<string, unknown> & {
  employees: FinanceOwnerRelationRow | FinanceOwnerRelationRow[]
}

export function normalizeFinanceOwner(
  owner: FinanceOwnerRelationRow
): FinanceOwner {
  const designation = Array.isArray(owner.designations)
    ? (owner.designations[0] ?? null)
    : (owner.designations ?? null)

  return {
    ...owner,
    designations: designation,
  }
}
