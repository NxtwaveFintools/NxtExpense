// All employee types are now defined in @/lib/services/employee-service
// and designation types in @/lib/services/config-service.
// This file is kept for backward compatibility but should not be used for new code.

export type Designation = string

export type Employee = {
  id: string
  employee_id: string
  employee_name: string
  employee_email: string
  state: string
  designation: string
  approval_employee_id_level_1: string | null
  approval_employee_id_level_2: string | null
  approval_employee_id_level_3: string | null
  created_at: string
}

export type ApprovalChain = {
  level1: string | null
  level2: string | null
  level3: string | null
}
