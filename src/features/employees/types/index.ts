export const DESIGNATION_VALUES = [
  'Student Relationship Officer',
  'Business Operation Associate',
  'Area Business Head',
  'State Business Head',
  'Zonal Business Head',
  'Program Manager',
  'Finance',
  'Admin',
] as const

export type Designation = (typeof DESIGNATION_VALUES)[number]

export type Employee = {
  id: string
  employee_id: string
  employee_name: string
  employee_email: string
  state: string
  designation: Designation
  approval_email_level_1: string | null
  approval_email_level_2: string | null
  approval_email_level_3: string | null
  created_at: string
}

export type ApprovalChain = {
  level1: string | null
  level2: string | null
  level3: string | null
}
