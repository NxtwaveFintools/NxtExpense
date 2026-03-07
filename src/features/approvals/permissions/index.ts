import type { Claim } from '@/features/claims/types'
import type { Employee } from '@/features/employees/types'

export function getApproverCurrentLevel(
  approverEmail: string,
  ownerEmployee: Employee
): 1 | 2 | 3 | null {
  const lowerEmail = approverEmail.toLowerCase()

  if (ownerEmployee.approval_email_level_1?.toLowerCase() === lowerEmail) {
    return 1
  }

  if (ownerEmployee.approval_email_level_2?.toLowerCase() === lowerEmail) {
    return 2
  }

  if (ownerEmployee.approval_email_level_3?.toLowerCase() === lowerEmail) {
    return 3
  }

  return null
}

export function canApproveAtLevel(
  approverEmail: string,
  claim: Claim,
  ownerEmployee: Employee
): boolean {
  const approverLevel = getApproverCurrentLevel(approverEmail, ownerEmployee)

  return (
    approverLevel !== null && claim.current_approval_level === approverLevel
  )
}
