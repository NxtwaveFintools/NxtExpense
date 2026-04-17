import { describe, expect, it } from 'vitest'

import {
  expandMappedExpenseItemTypesForExport,
  getCanonicalExportAccountItemType,
} from '@/features/finance/utils/export-item-type-mapping'

describe('export item type mapping', () => {
  it('includes intercity_travel when fuel is mapped', () => {
    expect(expandMappedExpenseItemTypesForExport(['food', 'fuel'])).toEqual([
      'food',
      'fuel',
      'intercity_travel',
    ])
  })

  it('does not duplicate intercity_travel when already present', () => {
    expect(
      expandMappedExpenseItemTypesForExport([
        'food',
        'fuel',
        'intercity_travel',
      ])
    ).toEqual(['food', 'fuel', 'intercity_travel'])
  })

  it('canonicalizes intercity_travel to fuel for account lookup', () => {
    expect(getCanonicalExportAccountItemType('intercity_travel')).toBe('fuel')
    expect(getCanonicalExportAccountItemType('food')).toBe('food')
  })
})
