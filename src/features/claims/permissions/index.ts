import type { Claim } from '@/features/claims/types'
import type { EmployeeRow } from '@/lib/services/employee-service'

export function canViewClaim(employee: EmployeeRow, claim: Claim): boolean {
  return employee.id === claim.employee_id
}

export function canEditClaim(employee: EmployeeRow, claim: Claim): boolean {
  // Claim is editable before first submission or when resubmission is allowed.
  return (
    employee.id === claim.employee_id &&
    (!claim.submitted_at || claim.allow_resubmit)
  )
}
