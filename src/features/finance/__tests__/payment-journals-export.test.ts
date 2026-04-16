import { describe, expect, it } from 'vitest'

import {
  accumulatePaymentJournalsEmployeeTotals,
  buildPaymentJournalsRows,
  PAYMENT_JOURNALS_CSV_HEADERS,
  resolvePaymentJournalsDefaults,
  toCsvLine,
} from '@/features/finance/utils/payment-journals-export'
import type { FinanceHistoryItem } from '@/features/finance/types'
import type { FinanceExportProfile } from '@/lib/services/finance-export-config-service'

const PROFILE: FinanceExportProfile = {
  profile_code: 'PAYMENT_JOURNALS',
  account_type: 'Employee',
  employee_transaction_type: 'ADVANCE',
  bal_account_type: 'Bank Account',
  default_document_no: '',
  program_code: 'NIAT',
  sub_product_code: 'NIAT362',
  responsible_dep_code: 'PRE-SALES',
  beneficiary_dep_code: 'PRE-SALES',
  document_type: 'Payment',
  cash_flow_options: 'Petty cash & Reimbursements',
  type_of_payment: '100% Payment after Service / Goods delivery',
  description: 'Reimbursements',
  payment_method_code: 'IMPS',
  bal_account_no: 'IDFC 2012',
  is_active: true,
}

function buildHistoryRow(
  claimId: string,
  claimNumber: string,
  totalAmount: number,
  employeeId: string
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
      status_id: 'status-payment-issued',
      is_terminal: true,
      is_rejection: false,
      submitted_at: '2026-04-11T10:00:00Z',
      current_approval_level: 4,
      resubmission_count: 0,
      allow_resubmit: false,
      is_superseded: false,
      last_rejection_notes: null,
      last_rejected_at: null,
      created_at: '2026-04-11T10:00:00Z',
      updated_at: '2026-04-12T10:00:00Z',
      food_with_principals_amount: null,
      accommodation_nights: null,
    },
    owner: {
      id: 'owner-1',
      employee_id: employeeId,
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
      acted_at: '2026-04-12T10:00:00Z',
    },
    availableActions: [],
  }
}

describe('payment journals export util', () => {
  it('keeps the exact locked header order', () => {
    expect(PAYMENT_JOURNALS_CSV_HEADERS).toEqual([
      'Posting Date',
      'Document Type',
      'Document No.',
      'External Document No.',
      'Account Type',
      'Account No.',
      'Vendor Balance',
      'Employee Balance',
      'Employee Transaction Type',
      'Cash Flow Options',
      'Type Of Payment',
      'Credit Memo No',
      'Amount Excl. GST',
      'Description',
      'Payment Method Code',
      'Amount',
      'Bal. Account Type',
      'Bal. Account No.',
      'Program Code',
      'Sub product Code',
      'Responsible dep Code',
      'Beneficiary dep Code',
    ])
  })

  it('builds one row per employee and sums mapped claim-item totals', () => {
    const defaults = resolvePaymentJournalsDefaults(PROFILE)
    const totalsByEmployeeId = new Map<string, number>()
    const seenClaimIds = new Set<string>()

    accumulatePaymentJournalsEmployeeTotals({
      historyRows: [
        buildHistoryRow('claim-1', 'CLAIM-1', 1000, 'NW0004545'),
        buildHistoryRow('claim-1', 'CLAIM-1', 1000, 'NW0004545'),
        buildHistoryRow('claim-2', 'CLAIM-2', 2500.5, 'NW0004545'),
        buildHistoryRow('claim-3', 'CLAIM-3', 700, 'NW0004546'),
      ],
      claimItemsByClaimId: new Map([
        ['claim-1', [{ amount: 400 }, { amount: 600 }]],
        ['claim-2', [{ amount: 2450.5 }]],
        ['claim-3', [{ amount: 700 }]],
      ]),
      seenClaimIds,
      totalsByEmployeeId,
    })

    const rows = buildPaymentJournalsRows({
      totalsByEmployeeId,
      defaults,
    })

    expect(rows).toHaveLength(2)

    expect(rows[0]).toEqual([
      '',
      'Payment',
      '',
      '',
      'Employee',
      'NW0004545',
      '0',
      '0',
      'ADVANCE',
      'Petty cash & Reimbursements',
      '100% Payment after Service / Goods delivery',
      '',
      '0',
      'Reimbursements',
      'IMPS',
      '3450.50',
      'Bank Account',
      'IDFC 2012',
      'NIAT',
      'NIAT362',
      'PRE-SALES',
      'PRE-SALES',
    ])

    expect(rows[1][5]).toBe('NW0004546')
    expect(rows[1][15]).toBe('700.00')
  })

  it('formats amount as positive value and escapes csv cells', () => {
    const defaults = resolvePaymentJournalsDefaults(PROFILE)
    const totalsByEmployeeId = new Map<string, number>()

    accumulatePaymentJournalsEmployeeTotals({
      historyRows: [buildHistoryRow('claim-1', 'CLAIM-1', -321.4, 'NW0004545')],
      claimItemsByClaimId: new Map([['claim-1', [{ amount: -321.4 }]]]),
      seenClaimIds: new Set<string>(),
      totalsByEmployeeId,
    })

    const rows = buildPaymentJournalsRows({
      totalsByEmployeeId,
      defaults,
    })

    expect(rows[0][15]).toBe('321.40')

    const line = toCsvLine(['alpha', 'x"y', 'value,with,comma'])
    expect(line).toBe('"alpha","x""y","value,with,comma"')
  })

  it('throws when required profile fields are missing', () => {
    expect(() =>
      resolvePaymentJournalsDefaults({
        ...PROFILE,
        payment_method_code: null,
      })
    ).toThrow('Payment Journals export profile is missing payment method code.')
  })

  it('skips claims that do not have mapped item rows', () => {
    const totalsByEmployeeId = new Map<string, number>()

    accumulatePaymentJournalsEmployeeTotals({
      historyRows: [buildHistoryRow('claim-4', 'CLAIM-4', 999, 'NW0004547')],
      claimItemsByClaimId: new Map(),
      seenClaimIds: new Set<string>(),
      totalsByEmployeeId,
    })

    expect(totalsByEmployeeId.size).toBe(0)
  })
})
