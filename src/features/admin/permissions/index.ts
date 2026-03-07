import type { Employee } from '@/features/employees/types'

export function isAdminUser(employee: Employee): boolean {
  return employee.designation === 'Admin'
}
