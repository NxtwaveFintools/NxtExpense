import type { SupabaseClient } from '@supabase/supabase-js'

export type ExpenseLocation = {
  id: string
  location_name: string
  region_code: string
  display_order: number
  is_active: boolean
}

const EXPENSE_LOCATION_COLUMNS =
  'id, location_name, region_code, display_order, is_active'

export async function getAllExpenseLocations(
  supabase: SupabaseClient
): Promise<ExpenseLocation[]> {
  const { data, error } = await supabase
    .from('expense_locations')
    .select(EXPENSE_LOCATION_COLUMNS)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('location_name', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch expense locations: ${error.message}`)
  }

  return (data ?? []) as ExpenseLocation[]
}

export async function getExpenseLocationById(
  supabase: SupabaseClient,
  expenseLocationId: string
): Promise<ExpenseLocation | null> {
  const { data, error } = await supabase
    .from('expense_locations')
    .select(EXPENSE_LOCATION_COLUMNS)
    .eq('id', expenseLocationId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch expense location: ${error.message}`)
  }

  return (data as ExpenseLocation | null) ?? null
}
