import type { SupabaseClient } from '@supabase/supabase-js'

type EmployeeNameSuggestionRow = {
  employee_name: string | null
}

function isMissingEmployeeNameSuggestionsRpcError(
  error: { message?: string } | null
): boolean {
  const message = error?.message?.toLowerCase() ?? ''

  return (
    message.includes('get_approval_employee_name_suggestions') &&
    (message.includes('schema cache') || message.includes('does not exist'))
  )
}

export async function getScopedEmployeeNameSuggestions(
  supabase: SupabaseClient,
  employeeNameSearch: string | null,
  limit = 50
): Promise<string[]> {
  const normalizedSearch = employeeNameSearch?.trim() ?? ''

  const { data, error } = await supabase.rpc(
    'get_approval_employee_name_suggestions',
    {
      p_name_search: normalizedSearch.length > 0 ? normalizedSearch : null,
      p_limit: Math.max(1, Math.min(limit, 200)),
    }
  )

  if (error) {
    if (isMissingEmployeeNameSuggestionsRpcError(error)) {
      return []
    }

    throw new Error(error.message)
  }

  const normalizedNames = ((data ?? []) as EmployeeNameSuggestionRow[])
    .map((row) => row.employee_name?.trim() ?? '')
    .filter((name) => name.length > 0)

  return Array.from(new Set(normalizedNames))
}
