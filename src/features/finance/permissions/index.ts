import type { Employee } from '@/features/employees/types'

export function isFinanceTeamMember(employee: Employee): boolean {
  return employee.designation === 'Finance'
}
