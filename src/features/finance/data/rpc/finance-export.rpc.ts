import type { SupabaseClient } from '@supabase/supabase-js'

// Per-employee total returned by get_finance_payment_journal_totals. employee_id is the
// employees business code (text), matching the "Account No." column the CSV emits.
export type PaymentJournalTotalRow = {
  employee_id: string
  total_amount: number | string
}

export async function getFinancePaymentJournalTotalsRpc(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<PaymentJournalTotalRow[]> {
  const { data, error } = await supabase.rpc(
    'get_finance_payment_journal_totals',
    args
  )

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as PaymentJournalTotalRow[]
}
