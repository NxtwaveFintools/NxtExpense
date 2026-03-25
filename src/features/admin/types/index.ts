export type AdminActionResult = {
  ok: boolean
  error: string | null
}

export type AdminStatusChangeResult = AdminActionResult & {
  claimId?: string
  previousStatusCode?: string
  updatedStatusCode?: string
}

export type AdminReassignResult = AdminActionResult & {
  impactedClaims?: number
}

export type AdminEmployeeFormOptions = {
  designations: Array<{
    id: string
    designation_name: string
    designation_code: string
  }>
  statuses: Array<{
    id: string
    status_name: string
    status_code: string
  }>
  roles: Array<{
    id: string
    role_name: string
    role_code: string
  }>
  states: Array<{
    id: string
    state_name: string
    state_code: string
  }>
  approversByLevel: {
    level1: Array<{
      id: string
      employee_name: string
      employee_email: string
    }>
    level2: Array<{
      id: string
      employee_name: string
      employee_email: string
    }>
    level3: Array<{
      id: string
      employee_name: string
      employee_email: string
    }>
  }
  approverRuleLabelsByLevel: {
    level1: string[]
    level2: string[]
    level3: string[]
  }
}

export type AdminCreateEmployeeResult = AdminActionResult & {
  employee?: {
    id: string
    employee_id: string
    employee_name: string
    employee_email: string
  }
}
