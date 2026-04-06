'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getEmployeeByEmail } from '@/lib/services/employee-service'
import { isFinanceTeamMember } from '@/features/finance/permissions'
import { getScopedEmployeeNameSuggestions } from '@/lib/services/employee-name-suggestions-service'

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

export async function getFinanceEmployeeNameSuggestionsAction(
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
    if (!employee || !(await isFinanceTeamMember(supabase, employee))) {
      return { ok: false, error: 'Finance access is required.' }
    }

    const names = await getScopedEmployeeNameSuggestions(
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
