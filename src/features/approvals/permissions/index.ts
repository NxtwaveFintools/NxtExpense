import type { Claim } from '@/features/claims/types'
import type { EmployeeRow } from '@/lib/services/employee-service'

export function getApproverCurrentLevel(
  approverId: string,
  ownerEmployee: EmployeeRow
): 1 | 2 | 3 | null {
  if (ownerEmployee.approval_employee_id_level_1 === approverId) {
    return 1
  }

  if (ownerEmployee.approval_employee_id_level_2 === approverId) {
    return 2
  }

  if (ownerEmployee.approval_employee_id_level_3 === approverId) {
    return 3
  }

  return null
}

export function canApproveAtLevel(
  approverId: string,
  claim: Claim,
  ownerEmployee: EmployeeRow
): boolean {
  const approverLevel = getApproverCurrentLevel(approverId, ownerEmployee)

  return (
    approverLevel !== null && claim.current_approval_level === approverLevel
  )
}
