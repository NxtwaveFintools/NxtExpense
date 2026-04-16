import { CLAIM_ITEM_TYPES } from '@/lib/constants/claim-expense'

function dedupePreserveOrder(itemTypes: readonly string[]): string[] {
  const seen = new Set<string>()
  const deduped: string[] = []

  for (const itemType of itemTypes) {
    if (seen.has(itemType)) {
      continue
    }

    seen.add(itemType)
    deduped.push(itemType)
  }

  return deduped
}

export function expandMappedExpenseItemTypesForExport(
  mappedExpenseItemTypes: readonly string[]
): string[] {
  const expandedTypes = dedupePreserveOrder(mappedExpenseItemTypes)

  if (
    expandedTypes.includes(CLAIM_ITEM_TYPES.FUEL) &&
    !expandedTypes.includes(CLAIM_ITEM_TYPES.INTERCITY_TRAVEL)
  ) {
    expandedTypes.push(CLAIM_ITEM_TYPES.INTERCITY_TRAVEL)
  }

  return expandedTypes
}

export function getCanonicalExportAccountItemType(itemType: string): string {
  if (itemType === CLAIM_ITEM_TYPES.INTERCITY_TRAVEL) {
    return CLAIM_ITEM_TYPES.FUEL
  }

  return itemType
}
