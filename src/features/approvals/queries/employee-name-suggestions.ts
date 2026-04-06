import type { SupabaseClient } from '@supabase/supabase-js'
import { getScopedEmployeeNameSuggestions } from '@/lib/services/employee-name-suggestions-service'

export async function getApprovalEmployeeNameSuggestions(
  supabase: SupabaseClient,
  employeeNameSearch: string | null,
  limit = 100
): Promise<string[]> {
  return getScopedEmployeeNameSuggestions(supabase, employeeNameSearch, limit)
}
