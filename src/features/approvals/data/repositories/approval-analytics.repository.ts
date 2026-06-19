import type { SupabaseClient } from '@supabase/supabase-js'

type ClaimStatusRow = {
  id: string
  is_payment_issued: boolean
}

export async function getPaymentIssuedStatusIds(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('claim_statuses')
    .select('id, is_payment_issued')
    .eq('is_active', true)

  if (error) {
    throw new Error(error.message)
  }

  return new Set(
    ((data ?? []) as ClaimStatusRow[])
      .filter((status) => status.is_payment_issued)
      .map((status) => status.id)
  )
}
