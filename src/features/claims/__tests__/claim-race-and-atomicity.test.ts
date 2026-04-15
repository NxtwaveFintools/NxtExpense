import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  getEmployeeRoles: vi.fn(),
  canAccessEmployeeClaimsFromRoles: vi.fn(),
  getAllWorkLocations: vi.fn(),
  getBaseLocationDayTypeByCode: vi.fn(),
  getDefaultBaseLocationDayType: vi.fn(),
  getDesignationApprovalFlow: vi.fn(),
  calculateBaseLocationItems: vi.fn(),
  calculateOutstationTravelItems: vi.fn(),
  getVehicleTypeById: vi.fn(),
  countFoodWithPrincipalsInMonth: vi.fn(),
  getFoodWithPrincipalsLimit: vi.fn(),
  getExpenseLocationById: vi.fn(),
  getClaimForDate: vi.fn(),
  insertClaim: vi.fn(),
  insertClaimItems: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/lib/services/employee-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/services/employee-service')
  >('@/lib/services/employee-service')

  return {
    ...actual,
    getEmployeeByEmail: mocks.getEmployeeByEmail,
    getEmployeeRoles: mocks.getEmployeeRoles,
  }
})

vi.mock('@/lib/services/approval-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/services/approval-service')
  >('@/lib/services/approval-service')

  return {
    ...actual,
    canAccessEmployeeClaimsFromRoles: mocks.canAccessEmployeeClaimsFromRoles,
  }
})

vi.mock('@/lib/services/config-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/services/config-service')
  >('@/lib/services/config-service')

  return {
    ...actual,
    getAllWorkLocations: mocks.getAllWorkLocations,
    getBaseLocationDayTypeByCode: mocks.getBaseLocationDayTypeByCode,
    getDefaultBaseLocationDayType: mocks.getDefaultBaseLocationDayType,
    getDesignationApprovalFlow: mocks.getDesignationApprovalFlow,
  }
})

vi.mock('@/lib/services/calculation-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/services/calculation-service')
  >('@/lib/services/calculation-service')

  return {
    ...actual,
    calculateBaseLocationItems: mocks.calculateBaseLocationItems,
    calculateOutstationTravelItems: mocks.calculateOutstationTravelItems,
    getVehicleTypeById: mocks.getVehicleTypeById,
    countFoodWithPrincipalsInMonth: mocks.countFoodWithPrincipalsInMonth,
    getFoodWithPrincipalsLimit: mocks.getFoodWithPrincipalsLimit,
  }
})

vi.mock('@/lib/services/expense-location-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/services/expense-location-service')
  >('@/lib/services/expense-location-service')

  return {
    ...actual,
    getExpenseLocationById: mocks.getExpenseLocationById,
  }
})

vi.mock('@/features/claims/mutations', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/claims/mutations')
  >('@/features/claims/mutations')

  return {
    ...actual,
    getClaimForDate: mocks.getClaimForDate,
    insertClaim: mocks.insertClaim,
    insertClaimItems: mocks.insertClaimItems,
  }
})

import { submitClaimAction } from '@/features/claims/actions'

const VALID_FORM_INPUT = {
  claimDate: '06/03/2026',
  workLocation: 'Office / WFH',
  expenseLocationId: 'expense-location-1',
}

function buildClaimStatusesQuery() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: { id: 'status-l1' }, error: null }),
  }
}

describe('submitClaimAction race and atomicity coverage', () => {
  let rpcMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    rpcMock = vi.fn().mockResolvedValue({ error: null })

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { email: 'employee@nxtwave.co.in' },
          },
        }),
      },
      rpc: rpcMock,
      from: vi.fn((table: string) => {
        if (table === 'claim_statuses') {
          return buildClaimStatusesQuery()
        }

        throw new Error(`Unexpected table query in test: ${table}`)
      }),
    })

    mocks.getEmployeeByEmail.mockResolvedValue({
      id: 'emp-1',
      designation_id: 'desig-1',
      employee_statuses: { status_code: 'ACTIVE' },
    })

    mocks.getEmployeeRoles.mockResolvedValue([{ role_code: 'EMPLOYEE' }])
    mocks.canAccessEmployeeClaimsFromRoles.mockReturnValue(true)

    mocks.getAllWorkLocations.mockResolvedValue([
      {
        id: 'Office / WFH',
        requires_vehicle_selection: false,
        requires_outstation_details: false,
      },
    ])

    mocks.getDesignationApprovalFlow.mockResolvedValue({
      required_approval_levels: [1],
    })

    mocks.getClaimForDate.mockResolvedValue(null)
    mocks.getExpenseLocationById.mockResolvedValue({
      id: 'expense-location-1',
      location_name: 'Presales-Hyderabad',
      region_code: 'TELUGU',
      display_order: 1,
      is_active: true,
    })
    mocks.insertClaim.mockResolvedValue({
      id: 'claim-new-1',
      claim_number: 'CLAIM-260306-001',
    })
    mocks.insertClaimItems.mockResolvedValue(undefined)
  })

  it('returns one success and one duplicate error when replacement claim submissions race', async () => {
    mocks.getClaimForDate.mockResolvedValue({
      id: 'claim-old-rejected',
      claim_number: 'CLAIM-260306-000',
      status_code: 'REJECTED',
      current_approval_level: null,
      is_rejection: true,
      is_terminal: true,
      allow_resubmit: true,
      is_superseded: false,
    })

    let insertAttempt = 0
    mocks.insertClaim.mockImplementation(async () => {
      insertAttempt += 1

      if (insertAttempt === 1) {
        return {
          id: 'claim-new-1',
          claim_number: 'CLAIM-260306-001',
        }
      }

      throw new Error(
        'duplicate key value violates unique constraint "expense_claims_one_active_per_employee_date"'
      )
    })

    const [first, second] = await Promise.all([
      submitClaimAction(VALID_FORM_INPUT),
      submitClaimAction(VALID_FORM_INPUT),
    ])

    const allResults = [first, second]
    const successCount = allResults.filter((result) => result.ok).length
    const failedResults = allResults.filter((result) => !result.ok)

    expect(successCount).toBe(1)
    expect(failedResults).toHaveLength(1)
    expect(failedResults[0]?.error).toBe(
      'Claim already submitted for this date. Please open My Claims to view the existing claim.'
    )
    expect(rpcMock).toHaveBeenCalledTimes(2)
  })

  it('surfaces line-item insert failure after claim header insert', async () => {
    mocks.insertClaim.mockResolvedValue({
      id: 'claim-new-atomicity',
      claim_number: 'CLAIM-260306-002',
    })
    mocks.insertClaimItems.mockRejectedValue(
      new Error('Claim items insert failed after header insert.')
    )

    const result = await submitClaimAction(VALID_FORM_INPUT)

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Claim items insert failed after header insert.')
    expect(mocks.insertClaim).toHaveBeenCalledTimes(1)
    expect(mocks.insertClaimItems).toHaveBeenCalledTimes(1)
  })

  it('blocks supersede flow when RPC rejects ownership', async () => {
    mocks.getClaimForDate.mockResolvedValue({
      id: 'claim-old-rejected',
      claim_number: 'CLAIM-260306-000',
      status_code: 'REJECTED',
      current_approval_level: null,
      is_rejection: true,
      is_terminal: true,
      allow_resubmit: true,
      is_superseded: false,
    })

    rpcMock.mockResolvedValue({
      error: { message: 'You can only supersede your own claims.' },
    })

    const result = await submitClaimAction(VALID_FORM_INPUT)

    expect(result.ok).toBe(false)
    expect(result.error).toBe('You can only supersede your own claims.')
    expect(mocks.insertClaim).not.toHaveBeenCalled()
    expect(mocks.insertClaimItems).not.toHaveBeenCalled()
  })
})
