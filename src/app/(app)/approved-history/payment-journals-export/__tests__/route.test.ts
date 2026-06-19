import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  isFinanceTeamMember: vi.fn(),
  getFinancePaymentJournalTotals: vi.fn(),
  normalizeFinanceFilters: vi.fn(),
  getFinanceExportProfileByCode: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/lib/services/employee-service', () => ({
  getEmployeeByEmail: mocks.getEmployeeByEmail,
}))

vi.mock('@/features/finance/permissions', () => ({
  isFinanceTeamMember: mocks.isFinanceTeamMember,
}))

vi.mock('@/features/finance/data/queries', () => ({
  getFinancePaymentJournalTotals: mocks.getFinancePaymentJournalTotals,
}))

vi.mock('@/features/finance/utils/filters', () => ({
  normalizeFinanceFilters: mocks.normalizeFinanceFilters,
}))

vi.mock('@/lib/services/finance-export-config-service', () => ({
  getFinanceExportProfileByCode: mocks.getFinanceExportProfileByCode,
}))

import {
  GET,
  POST,
} from '@/app/(app)/approved-history/payment-journals-export/route'

const PAYMENT_PROFILE = {
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

function buildSupabaseAuthClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { email: 'finance@nxtwave.co.in' } },
      }),
    },
  }
}

describe('approved-history Payment Journals export route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.normalizeFinanceFilters.mockReturnValue({
      employeeId: null,
      employeeName: null,
      claimNumber: null,
      ownerDesignation: null,
      hodApproverEmployeeId: null,
      claimStatus: null,
      workLocation: null,
      actionFilter: null,
      dateFilterField: 'claim_date',
      dateFrom: null,
      dateTo: null,
    })

    mocks.getEmployeeByEmail.mockResolvedValue({ id: 'finance-1' })
    mocks.isFinanceTeamMember.mockResolvedValue(true)
    mocks.getFinanceExportProfileByCode.mockResolvedValue(PAYMENT_PROFILE)
    mocks.getFinancePaymentJournalTotals.mockResolvedValue(
      new Map<string, number>()
    )

    mocks.createSupabaseServerClient.mockResolvedValue(
      buildSupabaseAuthClient()
    )
  })

  it('streams one row per employee from the DB-aggregated totals', async () => {
    mocks.getFinancePaymentJournalTotals.mockResolvedValue(
      new Map<string, number>([
        ['NW0004545', 3450.5],
        ['NW0004546', 500],
      ])
    )

    const response = await GET(
      new Request(
        'http://localhost:3000/approved-history/payment-journals-export'
      )
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/csv')

    const csv = await response.text()
    const csvLines = csv
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    expect(csvLines).toHaveLength(3)
    expect(csvLines[0]).toBe(
      '"Posting Date","Document Type","Document No.","External Document No.","Account Type","Account No.","Vendor Balance","Employee Balance","Employee Transaction Type","Cash Flow Options","Type Of Payment","Credit Memo No","Amount Excl. GST","Description","Payment Method Code","Amount","Bal. Account Type","Bal. Account No.","Program Code","Sub product Code","Responsible dep Code","Beneficiary dep Code"'
    )

    expect(csv).toContain(
      '"","Payment","","","Employee","NW0004545","0","0","ADVANCE","Petty cash & Reimbursements","100% Payment after Service / Goods delivery","","0","Reimbursements","IMPS","3450.50","Bank Account","IDFC 2012","NIAT","NIAT362","PRE-SALES","PRE-SALES"'
    )
    expect(csv).toContain(
      '"","Payment","","","Employee","NW0004546","0","0","ADVANCE","Petty cash & Reimbursements","100% Payment after Service / Goods delivery","","0","Reimbursements","IMPS","500.00","Bank Account","IDFC 2012","NIAT","NIAT362","PRE-SALES","PRE-SALES"'
    )

    expect(mocks.getFinancePaymentJournalTotals).toHaveBeenCalledTimes(1)
    expect(mocks.getFinancePaymentJournalTotals).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ claimStatus: null })
    )
  })

  it('excludes employees with zero payable amount from export rows', async () => {
    mocks.getFinancePaymentJournalTotals.mockResolvedValue(
      new Map<string, number>([
        ['NW0001211', 0],
        ['NW0004546', 500],
      ])
    )

    const response = await GET(
      new Request(
        'http://localhost:3000/approved-history/payment-journals-export'
      )
    )

    expect(response.status).toBe(200)

    const csv = await response.text()
    const csvLines = csv
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    expect(csvLines).toHaveLength(2)
    expect(csv).not.toContain('"NW0001211"')
    expect(csv).toContain('"NW0004546"')
    expect(csv).toContain('"500.00"')
  })

  it('keeps applied action filter without overriding claim status', async () => {
    mocks.normalizeFinanceFilters.mockReturnValueOnce({
      employeeId: null,
      employeeName: null,
      claimNumber: null,
      ownerDesignation: null,
      hodApproverEmployeeId: null,
      claimStatus: null,
      workLocation: null,
      actionFilter: 'payment_released',
      dateFilterField: 'claim_date',
      dateFrom: null,
      dateTo: null,
    })

    const response = await GET(
      new Request(
        'http://localhost:3000/approved-history/payment-journals-export?actionFilter=payment_released'
      )
    )

    expect(response.status).toBe(200)
    expect(mocks.getFinancePaymentJournalTotals).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        claimStatus: null,
        actionFilter: 'payment_released',
      })
    )
  })

  it('keeps status scope unset for rejected action filters', async () => {
    mocks.normalizeFinanceFilters.mockReturnValueOnce({
      employeeId: null,
      employeeName: null,
      claimNumber: null,
      ownerDesignation: null,
      hodApproverEmployeeId: null,
      claimStatus: null,
      workLocation: null,
      actionFilter: 'finance_rejected',
      dateFilterField: 'claim_date',
      dateFrom: null,
      dateTo: null,
    })

    const response = await GET(
      new Request(
        'http://localhost:3000/approved-history/payment-journals-export?actionFilter=finance_rejected'
      )
    )

    expect(response.status).toBe(200)
    expect(mocks.getFinancePaymentJournalTotals).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        claimStatus: null,
        actionFilter: 'finance_rejected',
      })
    )
  })

  it('forwards applied employee and date filters to the totals query', async () => {
    mocks.normalizeFinanceFilters.mockReturnValueOnce({
      employeeId: 'NW0000282',
      employeeName: null,
      claimNumber: null,
      ownerDesignation: null,
      hodApproverEmployeeId: null,
      claimStatus: null,
      workLocation: null,
      actionFilter: null,
      dateFilterField: 'claim_date',
      dateFrom: '2026-04-10',
      dateTo: '2026-04-16',
    })

    const response = await GET(
      new Request(
        'http://localhost:3000/approved-history/payment-journals-export?employeeId=NW0000282&dateFrom=2026-04-10&dateTo=2026-04-16'
      )
    )

    expect(response.status).toBe(200)
    expect(mocks.normalizeFinanceFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'NW0000282',
        dateFrom: '2026-04-10',
        dateTo: '2026-04-16',
      })
    )
    expect(mocks.getFinancePaymentJournalTotals).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        employeeId: 'NW0000282',
        dateFrom: '2026-04-10',
        dateTo: '2026-04-16',
        claimStatus: null,
      })
    )
  })

  it('returns 400 when export profile is missing', async () => {
    mocks.getFinanceExportProfileByCode.mockResolvedValue(null)

    const response = await GET(
      new Request(
        'http://localhost:3000/approved-history/payment-journals-export'
      )
    )

    expect(response.status).toBe(400)
    expect(await response.text()).toContain(
      'Payment Journals export profile is not configured.'
    )
  })

  it('returns 401 for unauthenticated requests', async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    })

    const response = await GET(
      new Request(
        'http://localhost:3000/approved-history/payment-journals-export'
      )
    )

    expect(response.status).toBe(401)
    expect(await response.text()).toBe('Unauthorized request.')
  })

  it('supports POST requests', async () => {
    const response = await POST(
      new Request(
        'http://localhost:3000/approved-history/payment-journals-export',
        {
          method: 'POST',
        }
      )
    )

    expect(response.status).toBe(200)
  })
})
