import type { SupabaseClient } from '@supabase/supabase-js'

export type ExpenseTypeAccountMapping = {
  expense_item_type: string
  bal_account_no: string
  is_active: boolean
}

export type FinanceExportProfile = {
  profile_code: string
  account_type: string
  employee_transaction_type: string
  bal_account_type: string
  default_document_no: string
  program_code: string
  sub_product_code: string
  responsible_dep_code: string
  beneficiary_dep_code: string
  document_type?: string | null
  cash_flow_options?: string | null
  type_of_payment?: string | null
  description?: string | null
  payment_method_code?: string | null
  bal_account_no?: string | null
  is_active: boolean
}

const FINANCE_EXPORT_PROFILE_COLUMNS =
  'profile_code, account_type, employee_transaction_type, bal_account_type, default_document_no, program_code, sub_product_code, responsible_dep_code, beneficiary_dep_code, document_type, cash_flow_options, type_of_payment, description, payment_method_code, bal_account_no, is_active'

export async function getFinanceExportProfileByCode(
  supabase: SupabaseClient,
  profileCode: string
): Promise<FinanceExportProfile | null> {
  const { data, error } = await supabase
    .from('finance_export_profiles')
    .select(FINANCE_EXPORT_PROFILE_COLUMNS)
    .eq('profile_code', profileCode)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch finance export profile: ${error.message}`)
  }

  return (data as FinanceExportProfile | null) ?? null
}

export async function getActiveExpenseTypeAccountMappings(
  supabase: SupabaseClient
): Promise<ExpenseTypeAccountMapping[]> {
  const { data, error } = await supabase
    .from('expense_type_account_mappings')
    .select('expense_item_type, bal_account_no, is_active')
    .eq('is_active', true)
    .order('expense_item_type', { ascending: true })

  if (error) {
    throw new Error(
      `Failed to fetch expense type account mappings: ${error.message}`
    )
  }

  return (data ?? []) as ExpenseTypeAccountMapping[]
}
