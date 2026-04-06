'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getEmployeeByEmail,
  hasApproverAssignments,
} from '@/lib/services/employee-service'
import { canAccessApprovals } from '@/features/employees/permissions'
import { getApprovalEmployeeNameSuggestions } from '@/features/approvals/queries/employee-name-suggestions'

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

export async function getApprovalEmployeeNameSuggestionsAction(
  employeeNameSearch: string | null
): Promise<ActionResult<string[]>> {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      return { ok: false, error: 'Unauthorized request.' }
    }

    const employee = await getEmployeeByEmail(supabase, user.email)
    if (!employee) {
      return { ok: false, error: 'Approver employee profile not found.' }
    }

    const approverAccess = await hasApproverAssignments(
      supabase,
      employee.employee_email
    )

    if (!canAccessApprovals(approverAccess)) {
      return { ok: false, error: 'Approval access is required.' }
    }

    const names = await getApprovalEmployeeNameSuggestions(
      supabase,
      employeeNameSearch,
      8
    )

    return { ok: true, data: names }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error.'
    return { ok: false, error: message }
  }
}
