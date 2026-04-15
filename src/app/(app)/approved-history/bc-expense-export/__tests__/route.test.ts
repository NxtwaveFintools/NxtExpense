import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  isFinanceTeamMember: vi.fn(),
  getFinanceHistoryPaginated: vi.fn(),
  normalizeFinanceFilters: vi.fn(),
  getFinanceExportProfileByCode: vi.fn(),
  getActiveExpenseTypeAccountMappings: vi.fn(),
  formatDate: vi.fn(),
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
  getActiveExpenseTypeAccountMappings:
    mocks.getActiveExpenseTypeAccountMappings,
}))

vi.mock('@/lib/utils/date', () => ({
  formatDate: mocks.formatDate,
}))

import { GET, POST } from '@/app/(app)/approved-history/bc-expense-export/route'

function buildSupabaseWithClaimItems(
  claimItems: Array<{ claim_id: string; item_type: string; amount: number }>
) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { email: 'finance@nxtwave.co.in' } },
      }),
    },
    from: vi.fn((tableName: string) => {
      if (tableName !== 'expense_claim_items') {
        throw new Error(`Unexpected table: ${tableName}`)
      }

      let inCallCount = 0
      const query = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockImplementation(() => {
          inCallCount += 1

          if (inCallCount === 1) {
            return query
          }

          return Promise.resolve({
            data: claimItems,
            error: null,
          })
        }),
      }

      return query
    }),
  }
}

describe('approved-history BC expense export route', () => {
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

    mocks.getFinanceExportProfileByCode.mockResolvedValue({
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
    })

    mocks.getActiveExpenseTypeAccountMappings.mockResolvedValue([
      { expense_item_type: 'food', bal_account_no: '503063', is_active: true },
      { expense_item_type: 'fuel', bal_account_no: '535002', is_active: true },
    ])

    mocks.formatDate.mockReturnValue('15/04/2026')
  })

  it('streams BC rows with food/fuel split and negative amounts', async () => {
    mocks.createSupabaseServerClient.mockResolvedValue(
      buildSupabaseWithClaimItems([
        { claim_id: 'claim-1', item_type: 'food', amount: 120 },
        { claim_id: 'claim-1', item_type: 'fuel', amount: 300 },
      ])
    )

    mocks.getFinanceHistoryPaginated.mockResolvedValue({
      data: [
        {
          claim: {
            id: 'claim-1',
            claim_number: 'CLAIM-31-03-26-0103',
            expense_region_code: 'COMMON',
          },
          owner: {
            employee_id: 'NW0001123',
          },
        },
      ],
      hasNextPage: false,
      nextCursor: null,
      limit: 500,
    })

    const response = await GET(
      new Request('http://localhost:3000/approved-history/bc-expense-export')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/csv')

    const csv = await response.text()

    expect(csv).toContain('"Posting Date","Document No.","Account Type"')
    expect(csv).toContain(
      '"15/04/2026","","Employee","NW0001123","ADVANCE","-120","CLAIM-31-03-26-0103","G/L Account","503063","NIAT","NIAT362","PRE-SALES","PRE-SALES","COMMON"'
    )
    expect(csv).toContain(
      '"15/04/2026","","Employee","NW0001123","ADVANCE","-300","CLAIM-31-03-26-0103","G/L Account","535002","NIAT","NIAT362","PRE-SALES","PRE-SALES","COMMON"'
    )
  })

  it('returns 400 when mapping config is missing', async () => {
    mocks.createSupabaseServerClient.mockResolvedValue(
      buildSupabaseWithClaimItems([])
    )
    mocks.getActiveExpenseTypeAccountMappings.mockResolvedValue([])

    const response = await GET(
      new Request('http://localhost:3000/approved-history/bc-expense-export')
    )

    expect(response.status).toBe(400)
    expect(await response.text()).toContain(
      'Expense type account mappings are not configured.'
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
      new Request('http://localhost:3000/approved-history/bc-expense-export')
    )

    expect(response.status).toBe(401)
    expect(await response.text()).toBe('Unauthorized request.')
  })

  it('supports POST requests', async () => {
    mocks.createSupabaseServerClient.mockResolvedValue(
      buildSupabaseWithClaimItems([])
    )

    mocks.getFinanceHistoryPaginated.mockResolvedValue({
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit: 500,
    })

    const response = await POST(
      new Request('http://localhost:3000/approved-history/bc-expense-export', {
        method: 'POST',
      })
    )

    expect(response.status).toBe(200)
  })
})
