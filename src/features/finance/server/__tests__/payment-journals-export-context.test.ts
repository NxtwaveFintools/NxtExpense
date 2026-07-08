import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getEmployeeByEmail: vi.fn(),
  isFinanceTeamMember: vi.fn(),
  getFinanceExportProfileByCode: vi.fn(),
}))

vi.mock('@/lib/services/employee-service', () => ({
  getEmployeeByEmail: mocks.getEmployeeByEmail,
}))

vi.mock('@/features/finance/permissions', () => ({
  isFinanceTeamMember: mocks.isFinanceTeamMember,
}))

vi.mock('@/lib/services/finance-export-config-service', () => ({
  getFinanceExportProfileByCode: mocks.getFinanceExportProfileByCode,
}))

import {
  resolvePaymentJournalsExportContext,
  resolvePaymentJournalsExportPreflight,
} from '@/features/finance/server/payment-journals-export-context'

const supabase = {} as import('@supabase/supabase-js').SupabaseClient

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

describe('resolvePaymentJournalsExportContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmployeeByEmail.mockResolvedValue({ id: 'emp-1' })
    mocks.isFinanceTeamMember.mockResolvedValue(true)
    mocks.getFinanceExportProfileByCode.mockResolvedValue(PAYMENT_PROFILE)
  })

  it('returns 401 when there is no authenticated user', async () => {
    const result = await resolvePaymentJournalsExportContext(
      supabase,
      null,
      new URLSearchParams()
    )
    expect(result).toEqual({
      ok: false,
      status: 401,
      message: 'Unauthorized request.',
    })
  })

  it('returns 403 when the employee is not a finance team member', async () => {
    mocks.isFinanceTeamMember.mockResolvedValue(false)

    const result = await resolvePaymentJournalsExportContext(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams()
    )
    expect(result).toEqual({
      ok: false,
      status: 403,
      message: 'Finance access is required.',
    })
  })

  it('returns 400 when the export profile is missing', async () => {
    mocks.getFinanceExportProfileByCode.mockResolvedValue(null)

    const result = await resolvePaymentJournalsExportContext(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams()
    )
    expect(result).toEqual({
      ok: false,
      status: 400,
      message: 'Payment Journals export profile is not configured.',
    })
  })

  it('resolves filters and defaults on success', async () => {
    const result = await resolvePaymentJournalsExportContext(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams({ actionFilter: 'finance_rejected' })
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.context.filters.claimStatus).toBeNull()
    expect(result.context.filters.actionFilter).toBe('finance_rejected')
    expect(result.context.defaults.balAccountNo).toBe('IDFC 2012')
  })
})

describe('resolvePaymentJournalsExportPreflight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmployeeByEmail.mockResolvedValue({ id: 'emp-1' })
    mocks.isFinanceTeamMember.mockResolvedValue(true)
    mocks.getFinanceExportProfileByCode.mockResolvedValue(PAYMENT_PROFILE)
  })

  it('returns { ok: true } on success', async () => {
    const result = await resolvePaymentJournalsExportPreflight(
      supabase,
      { email: 'finance@nxtwave.co.in' },
      new URLSearchParams()
    )

    expect(result).toEqual({ ok: true })
  })
})
