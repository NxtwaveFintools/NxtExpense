import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  isFinanceTeamMember: vi.fn(),
  getFinanceHistoryPaginated: vi.fn(),
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

vi.mock('@/features/finance/queries', () => ({
  getFinanceHistoryPaginated: mocks.getFinanceHistoryPaginated,
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

function buildHistoryRow(
  claimId: string,
  employeeId: string,
  totalAmount: number
) {
  return {
    claim: {
      id: claimId,
      claim_number: `CLAIM-${claimId}`,
      employee_id: 'owner-id',
      claim_date: '2026-04-12',
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
      allow_resubmit: false,
      is_superseded: false,
      current_approval_level: 4,
      submitted_at: '2026-04-12T10:00:00Z',
      created_at: '2026-04-12T10:00:00Z',
      updated_at: '2026-04-12T10:00:00Z',
      resubmission_count: 0,
      last_rejection_notes: null,
      last_rejected_at: null,
      accommodation_nights: null,
      food_with_principals_amount: null,
    },
    owner: {
      id: 'owner-id',
      employee_id: employeeId,
      employee_name: 'Owner Name',
      employee_email: 'owner@nxtwave.co.in',
      designation_id: 'des-1',
      designations: {
        designation_name: 'State Business Head',
      },
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

describe('approved-history Payment Journals export route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.normalizeFinanceFilters.mockReturnValue({
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

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: 'finance@nxtwave.co.in' } },
        }),
      },
    })
  })

  it('streams one row per employee with strict defaults and summed amount', async () => {
    mocks.getFinanceHistoryPaginated
      .mockResolvedValueOnce({
        data: [
          buildHistoryRow('claim-1', 'NW0004545', 1000),
          buildHistoryRow('claim-1', 'NW0004545', 1000),
        ],
        hasNextPage: true,
        nextCursor: 'cursor-2',
        limit: 500,
      })
      .mockResolvedValueOnce({
        data: [
          buildHistoryRow('claim-2', 'NW0004545', 2450.5),
          buildHistoryRow('claim-3', 'NW0004546', 500),
        ],
        hasNextPage: false,
        nextCursor: null,
        limit: 500,
      })

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

    expect(mocks.getFinanceHistoryPaginated).toHaveBeenCalledTimes(2)
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
    mocks.getFinanceHistoryPaginated.mockResolvedValue({
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit: 500,
    })

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
