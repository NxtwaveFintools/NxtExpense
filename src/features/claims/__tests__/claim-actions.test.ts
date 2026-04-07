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
  getVehicleTypeById: vi.fn(),
  countFoodWithPrincipalsInMonth: vi.fn(),
  getFoodWithPrincipalsLimit: vi.fn(),
  getClaimForDate: vi.fn(),
  insertClaim: vi.fn(),
  insertClaimItems: vi.fn(),
  getMyClaimsPaginated: vi.fn(),
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
    getVehicleTypeById: mocks.getVehicleTypeById,
    countFoodWithPrincipalsInMonth: mocks.countFoodWithPrincipalsInMonth,
    getFoodWithPrincipalsLimit: mocks.getFoodWithPrincipalsLimit,
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

vi.mock('@/features/claims/queries', () => ({
  getMyClaimsPaginated: mocks.getMyClaimsPaginated,
}))

import { getMyClaimsAction, submitClaimAction } from '@/features/claims/actions'

const VALID_FORM_INPUT = {
  claimDate: '06/03/2026',
  workLocation: 'Office / WFH',
}

describe('submitClaimAction', () => {
  let rpcMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    rpcMock = vi.fn().mockResolvedValue({ error: null })

    const claimStatusesQuery = {
      approvalLevel: 1,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(function (
        this: { approvalLevel: number },
        column: string,
        value: unknown
      ) {
        if (column === 'approval_level' && typeof value === 'number') {
          this.approvalLevel = value
        }
        return this
      }),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(function (this: {
        approvalLevel: number
      }) {
        if (this.approvalLevel === 99) {
          return Promise.resolve({ data: null, error: null })
        }
        return Promise.resolve({ data: { id: 'status-l1' }, error: null })
      }),
    }

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              email: 'employee@nxtwave.co.in',
            },
          },
        }),
      },
      rpc: rpcMock,
      from: vi.fn((table: string) => {
        if (table === 'claim_statuses') {
          return claimStatusesQuery
        }

        throw new Error(`Unexpected table query in test: ${table}`)
      }),
    })

    mocks.getEmployeeByEmail.mockResolvedValue({
      id: 'emp-1',
      designation_id: 'desg-1',
    })

    mocks.getEmployeeRoles.mockResolvedValue([{ role_code: 'EMPLOYEE' }])
    mocks.canAccessEmployeeClaimsFromRoles.mockReturnValue(true)
    mocks.getClaimForDate.mockResolvedValue(null)

    mocks.getAllWorkLocations.mockResolvedValue([
      {
        id: 'Office / WFH',
        requires_vehicle_selection: false,
        requires_outstation_details: false,
      },
    ])

    mocks.getBaseLocationDayTypeByCode.mockResolvedValue(null)
    mocks.getDefaultBaseLocationDayType.mockResolvedValue({
      day_type_code: 'FULL_DAY',
      day_type_label: 'Full Day',
      include_food_allowance: true,
      is_default: true,
      display_order: 1,
      is_active: true,
    })

    mocks.getDesignationApprovalFlow.mockResolvedValue({
      required_approval_levels: [1],
    })
    mocks.calculateBaseLocationItems.mockResolvedValue({ items: [], total: 0 })
    mocks.getVehicleTypeById.mockResolvedValue({
      vehicle_name: 'Two Wheeler',
      max_km_round_trip: 150,
    })
    mocks.countFoodWithPrincipalsInMonth.mockResolvedValue(0)
    mocks.getFoodWithPrincipalsLimit.mockResolvedValue(0)

    mocks.insertClaim.mockResolvedValue({
      id: 'claim-new-1',
      claim_number: 'CLAIM-20260306-001',
    })
    mocks.insertClaimItems.mockResolvedValue(undefined)

    mocks.getMyClaimsPaginated.mockResolvedValue({
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit: 10,
    })
  })

  it('should reject unauthenticated requests', async () => {
    // Arrange
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    })

    // Act
    const result = await submitClaimAction(VALID_FORM_INPUT)

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Unauthorized request.')
  })

  it('should block finance users from submitting claims (EDGE-016)', async () => {
    // Arrange
    mocks.canAccessEmployeeClaimsFromRoles.mockReturnValue(false)

    // Act
    const result = await submitClaimAction(VALID_FORM_INPUT)

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Your role cannot submit employee claims.')
  })

  it('should reject duplicate claims for same employee and date (EDGE-009)', async () => {
    // Arrange
    mocks.getClaimForDate.mockResolvedValue({
      id: 'claim-1',
      claim_number: 'CLAIM-20260306-001',
      status_code: 'L1_PENDING',
      current_approval_level: 1,
      is_rejection: false,
      is_terminal: false,
      allow_resubmit: false,
      is_superseded: false,
    })

    // Act
    const result = await submitClaimAction(VALID_FORM_INPUT)

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Claim already submitted for this date')
    expect(mocks.getClaimForDate).toHaveBeenCalledWith(
      expect.anything(),
      'emp-1',
      '2026-03-06'
    )
  })

  it('should surface duplicate insert conflicts as already-submitted errors', async () => {
    // Arrange
    mocks.insertClaim.mockRejectedValueOnce(
      new Error(
        'duplicate key value violates unique constraint "expense_claims_one_active_per_employee_date"'
      )
    )

    // Act
    const result = await submitClaimAction(VALID_FORM_INPUT)

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe(
      'Claim already submitted for this date. Please open My Claims to view the existing claim.'
    )
  })

  it('should allow new claim when previous claim is rejected and resubmission is allowed (EDGE-009)', async () => {
    // Arrange
    mocks.getClaimForDate.mockResolvedValue({
      id: 'claim-old-rejected',
      claim_number: 'CLAIM-20260306-0001',
      status_code: 'REJECTED',
      current_approval_level: null,
      is_rejection: true,
      is_terminal: true,
      allow_resubmit: true,
      is_superseded: false,
    })

    // Act
    const result = await submitClaimAction(VALID_FORM_INPUT)

    // Assert
    expect(result.ok).toBe(true)
    expect(result.claimId).toBe('claim-new-1')
    expect(rpcMock).toHaveBeenCalledWith('supersede_rejected_claim', {
      p_claim_id: 'claim-old-rejected',
    })
    expect(mocks.insertClaim).toHaveBeenCalledTimes(1)
  })

  it('should block resubmission when rejected claim does not allow resubmit', async () => {
    // Arrange
    mocks.getClaimForDate.mockResolvedValue({
      id: 'claim-old-rejected',
      claim_number: 'CLAIM-20260306-0001',
      status_code: 'REJECTED',
      current_approval_level: null,
      is_rejection: true,
      is_terminal: true,
      allow_resubmit: false,
      is_superseded: false,
    })

    // Act
    const result = await submitClaimAction(VALID_FORM_INPUT)

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toContain('permanently closed')
  })

  it('should allow claim submission when claim date differs', async () => {
    // Arrange
    const differentDateInput = {
      claimDate: '07/03/2026',
      workLocation: 'Office / WFH',
    }

    // Act
    const result = await submitClaimAction(differentDateInput)

    // Assert
    expect(result.ok).toBe(true)
    expect(mocks.getClaimForDate).toHaveBeenCalledWith(
      expect.anything(),
      'emp-1',
      '2026-03-07'
    )
  })

  it('should handle supersede RPC failures without partial inserts', async () => {
    // Arrange
    mocks.getClaimForDate.mockResolvedValue({
      id: 'claim-old-rejected',
      claim_number: 'CLAIM-20260306-0001',
      status_code: 'REJECTED',
      current_approval_level: null,
      is_rejection: true,
      is_terminal: true,
      allow_resubmit: true,
      is_superseded: false,
    })

    rpcMock.mockResolvedValue({
      error: { message: 'Failed to supersede rejected claim.' },
    })

    // Act
    const result = await submitClaimAction(VALID_FORM_INPUT)

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Failed to supersede rejected claim.')
    expect(mocks.insertClaim).not.toHaveBeenCalled()
    expect(mocks.insertClaimItems).not.toHaveBeenCalled()
  })

  it('should return employee profile not found when user is not provisioned', async () => {
    // Arrange
    mocks.getEmployeeByEmail.mockResolvedValue(null)

    // Act
    const result = await submitClaimAction(VALID_FORM_INPUT)

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Employee profile not found.')
  })

  it('should reject invalid claim payloads before DB operations', async () => {
    // Act
    const result = await submitClaimAction({
      claimDate: '31-03-2026',
      workLocation: 'Office / WFH',
    } as never)

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Date must be in DD/MM/YYYY format.')
    expect(mocks.getClaimForDate).not.toHaveBeenCalled()
  })
})

describe('getMyClaimsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { email: 'employee@nxtwave.co.in' },
          },
        }),
      },
    })

    mocks.getEmployeeByEmail.mockResolvedValue({
      id: 'emp-1',
      designation_id: 'desg-1',
    })

    mocks.getEmployeeRoles.mockResolvedValue([{ role_code: 'EMPLOYEE' }])
    mocks.canAccessEmployeeClaimsFromRoles.mockReturnValue(true)

    mocks.getMyClaimsPaginated.mockResolvedValue({
      data: [{ id: 'claim-1' }],
      hasNextPage: false,
      nextCursor: null,
      limit: 10,
    })
  })

  it('should return empty page when no user session is present', async () => {
    // Arrange
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    })

    // Act
    const result = await getMyClaimsAction(null, 10)

    // Assert
    expect(result).toEqual({
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit: 10,
    })
  })

  it('should return empty page when employee profile is missing', async () => {
    // Arrange
    mocks.getEmployeeByEmail.mockResolvedValue(null)

    // Act
    const result = await getMyClaimsAction(null, 10)

    // Assert
    expect(result).toEqual({
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit: 10,
    })
  })

  it('should return empty page when user cannot access claims', async () => {
    // Arrange
    mocks.canAccessEmployeeClaimsFromRoles.mockReturnValue(false)

    // Act
    const result = await getMyClaimsAction('cursor-1', 15)

    // Assert
    expect(result).toEqual({
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit: 15,
    })
  })

  it('should return paginated claims for authorized employees', async () => {
    // Act
    const result = await getMyClaimsAction('cursor-1', 10)

    // Assert
    expect(result.data).toHaveLength(1)
    expect(mocks.getMyClaimsPaginated).toHaveBeenCalledWith(
      expect.anything(),
      'emp-1',
      'cursor-1',
      10
    )
  })

  it('should return empty page when pagination query throws unexpectedly', async () => {
    mocks.getMyClaimsPaginated.mockRejectedValueOnce(
      new Error('Database timeout')
    )

    const result = await getMyClaimsAction('cursor-1', 10)

    expect(result).toEqual({
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit: 10,
    })
  })
})
