import type { Claim } from '@/features/claims/types'
import type { Employee } from '@/features/employees/types'

export function canViewClaim(employee: Employee, claim: Claim): boolean {
  return employee.id === claim.employee_id
}

export function canEditClaim(employee: Employee, claim: Claim): boolean {
  return employee.id === claim.employee_id && claim.status === 'draft'
}
