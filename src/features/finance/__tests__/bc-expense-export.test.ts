import { describe, expect, it } from 'vitest'

import {
  BC_EXPENSE_CSV_HEADERS,
  buildBcExpenseRows,
  toCsvLine,
} from '@/features/finance/utils/bc-expense-export'
import type { FinanceHistoryItem } from '@/features/finance/types'
import type { FinanceExportProfile } from '@/lib/services/finance-export-config-service'

const BC_PROFILE: FinanceExportProfile = {
  profile_code: 'BC_EXPENSE',
  account_type: 'Employee',
  employee_transaction_type: 'ADVANCE',
  bal_account_type: 'G/L Account',
  default_document_no: '',
  program_code: 'NIAT',
  sub_product_code: 'NIAT362',
  responsible_dep_code: 'PRE-SALES',
  beneficiary_dep_code: 'PRE-SALES',
  is_active: true,
}

function buildHistoryRow(
  claimId: string,
  claimNumber: string,
  regionCode: string | null = 'COMMON',
  totalAmount = 0
): FinanceHistoryItem {
  return {
    claim: {
      id: claimId,
      claim_number: claimNumber,
      employee_id: 'owner-1',
      claim_date: '2026-04-10',
      work_location: 'Office / WFH',
      own_vehicle_used: null,
      vehicle_type: null,
      outstation_city_name: null,
      from_city_name: null,
      to_city_name: null,
      km_travelled: null,
      total_amount: totalAmount,
      statusName: 'Payment Issued',
      statusDisplayColor: 'green',
      status_id: 'status-issued',
      is_terminal: true,
      is_rejection: false,
      allow_resubmit: false,
      is_superseded: false,
      current_approval_level: 4,
      submitted_at: '2026-04-10T10:00:00Z',
      created_at: '2026-04-10T10:00:00Z',
      updated_at: '2026-04-10T10:00:00Z',
      resubmission_count: 0,
      last_rejection_notes: null,
      last_rejected_at: null,
      accommodation_nights: null,
      food_with_principals_amount: null,
      expense_region_code: regionCode,
    },
    owner: {
      id: 'owner-1',
      employee_id: 'NW0004545',
      employee_name: 'Owner One',
      employee_email: 'owner1@nxtwave.co.in',
      designation_id: 'des-1',
      designations: { designation_name: 'State Business Head' },
    },
    action: {
      id: `action-${claimId}`,
      claim_id: claimId,
      actor_email: 'finance@nxtwave.co.in',
      actor_name: 'Finance User',
      action: 'issued',
      notes: null,
      acted_at: '2026-04-10T10:00:00Z',
    },
    availableActions: [],
  }
}

describe('bc expense export util', () => {
  it('keeps expected BC header order', () => {
    expect(BC_EXPENSE_CSV_HEADERS).toEqual([
      'Posting Date',
      'Document No.',
      'Account Type',
      'Account No.',
      'Employee Transaction Type',
      'Amount',
      'Description',
      'Bal. Account Type',
      'Bal. Account No.',
      'Program Code',
      'Sub product Code',
      'Responsible dep Code',
      'Beneficiary dep Code',
      'Region Code',
    ])
  })

  it('builds rows with negative amounts and skips unmapped item types', () => {
    const historyRows = [buildHistoryRow('claim-1', 'CLAIM-1', 'COMMON', 270.5)]
    const claimItemsByClaimId = new Map([
      [
        'claim-1',
        [
          { claim_id: 'claim-1', item_type: 'food', amount: 120 },
          { claim_id: 'claim-1', item_type: 'fuel', amount: 150.5 },
          { claim_id: 'claim-1', item_type: 'other', amount: 80 },
        ],
      ],
    ])

    const rows = buildBcExpenseRows({
      historyRows,
      claimItemsByClaimId,
      balAccountNoByItemType: new Map([
        ['food', '503063'],
        ['fuel', '535002'],
      ]),
      postingDate: '15/04/2026',
      exportProfile: BC_PROFILE,
    })

    expect(rows).toHaveLength(2)
    expect(rows[0][3]).toBe('NW0004545')
    expect(rows[1][3]).toBe('NW0004545')
    expect(rows[0][5]).toBe('-120')
    expect(rows[0][8]).toBe('503063')
    expect(rows[1][5]).toBe('-150.50')
    expect(rows[1][8]).toBe('535002')
  })

  it('maps intercity travel to fuel GL account in BC export rows', () => {
    const historyRows = [
      buildHistoryRow('claim-km', 'CLAIM-KM-1', 'COMMON', 480),
    ]
    const claimItemsByClaimId = new Map([
      [
        'claim-km',
        [
          {
            claim_id: 'claim-km',
            item_type: 'intercity_travel',
            amount: 480,
          },
        ],
      ],
    ])

    const rows = buildBcExpenseRows({
      historyRows,
      claimItemsByClaimId,
      balAccountNoByItemType: new Map([
        ['food', '503063'],
        ['fuel', '535002'],
      ]),
      postingDate: '15/04/2026',
      exportProfile: BC_PROFILE,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0][5]).toBe('-480')
    expect(rows[0][8]).toBe('535002')
  })

  it('escapes csv rows correctly', () => {
    const line = toCsvLine(['a,b', 'x"y'])
    expect(line).toBe('"a,b","x""y"')
  })

  it('returns no rows when claim items are absent for history records', () => {
    const rows = buildBcExpenseRows({
      historyRows: [buildHistoryRow('claim-3', 'CLAIM-3')],
      claimItemsByClaimId: new Map(),
      balAccountNoByItemType: new Map([['food', '503063']]),
      postingDate: '15/04/2026',
      exportProfile: BC_PROFILE,
    })

    expect(rows).toEqual([])
  })

  it('falls back to blank region when claim region is missing', () => {
    const rows = buildBcExpenseRows({
      historyRows: [buildHistoryRow('claim-4', 'CLAIM-4', null, 10)],
      claimItemsByClaimId: new Map([
        ['claim-4', [{ claim_id: 'claim-4', item_type: 'food', amount: 10 }]],
      ]),
      balAccountNoByItemType: new Map([['food', '503063']]),
      postingDate: '15/04/2026',
      exportProfile: BC_PROFILE,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0][13]).toBe('')
  })

  it('adds a reconciliation row when mapped items do not cover claim total', () => {
    const rows = buildBcExpenseRows({
      historyRows: [buildHistoryRow('claim-5', 'CLAIM-5', 'COMMON', 420)],
      claimItemsByClaimId: new Map([
        ['claim-5', [{ claim_id: 'claim-5', item_type: 'food', amount: 120 }]],
      ]),
      balAccountNoByItemType: new Map([
        ['food', '503063'],
        ['fuel', '535002'],
      ]),
      postingDate: '15/04/2026',
      exportProfile: BC_PROFILE,
    })

    expect(rows).toHaveLength(2)
    expect(rows[0][5]).toBe('-120')
    expect(rows[0][8]).toBe('503063')
    expect(rows[1][5]).toBe('-300')
    expect(rows[1][8]).toBe('535002')
  })
})
