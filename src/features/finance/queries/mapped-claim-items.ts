import type { SupabaseClient } from '@supabase/supabase-js'
import { expandMappedExpenseItemTypesForExport } from '@/features/finance/utils/export-item-type-mapping'

type MappedClaimItemRow = {
  claim_id: string
  item_type: string
  amount: number
}

function toNormalizedAmount(value: number | string): number {
  const numericValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

export async function getMappedClaimItemsByClaimId(
  supabase: SupabaseClient,
  claimIds: string[],
  mappedExpenseItemTypes: string[]
): Promise<Map<string, MappedClaimItemRow[]>> {
  if (claimIds.length === 0 || mappedExpenseItemTypes.length === 0) {
    return new Map<string, MappedClaimItemRow[]>()
  }

  const expandedMappedItemTypes = expandMappedExpenseItemTypesForExport(
    mappedExpenseItemTypes
  )

  const { data, error } = await supabase
    .from('expense_claim_items')
    .select('claim_id, item_type, amount')
    .in('claim_id', claimIds)
    .in('item_type', expandedMappedItemTypes)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as Array<{
    claim_id: string
    item_type: string
    amount: number | string
  }>

  const claimItemsByClaimId = new Map<string, MappedClaimItemRow[]>()

  for (const row of rows) {
    const item: MappedClaimItemRow = {
      claim_id: row.claim_id,
      item_type: row.item_type,
      amount: toNormalizedAmount(row.amount),
    }

    const currentRows = claimItemsByClaimId.get(row.claim_id)

    if (currentRows) {
      currentRows.push(item)
      continue
    }

    claimItemsByClaimId.set(row.claim_id, [item])
  }

  return claimItemsByClaimId
}
