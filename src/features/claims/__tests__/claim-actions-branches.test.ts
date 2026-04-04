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
    calculateOutstationTravelItems: mocks.calculateOutstationTravelItems,
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

import { submitClaimAction } from '@/features/claims/actions'

const BASE_LOCATION_INPUT = {
  claimDate: '06/03/2026',
  workLocation: 'wl-base',
  vehicleType: 'veh-2w',
  baseLocationDayTypeCode: 'FULL_DAY',
}

const OUTSTATION_OWN_INPUT = {
  claimDate: '06/03/2026',
  workLocation: 'wl-outstation',
  hasIntercityTravel: true,
  hasIntracityTravel: false,
  intercityOwnVehicleUsed: true,
  intracityOwnVehicleUsed: false,
  vehicleType: 'veh-2w',
  outstationStateId: 'state-tg',
  fromCityId: 'city-a',
  toCityId: 'city-b',
  kmTravelled: 100,
  accommodationNights: 1,
  foodWithPrincipalsAmount: 0,
}

const OUTSTATION_NO_OWN_VEHICLE_INPUT = {
  claimDate: '06/03/2026',
  workLocation: 'wl-outstation',
  hasIntercityTravel: false,
  hasIntracityTravel: false,
  intercityOwnVehicleUsed: false,
  intracityOwnVehicleUsed: false,
  accommodationNights: 0,
  foodWithPrincipalsAmount: 0,
}

describe('submitClaimAction branch coverage', () => {
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

    const citiesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockImplementation((_column: string, ids: string[]) =>
        Promise.resolve({
          data: ids.map((id) => ({ id })),
          error: null,
        })
      ),
    }

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
        if (table === 'cities') {
          return citiesQuery
        }

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
        id: 'wl-base',
        requires_vehicle_selection: true,
        requires_outstation_details: false,
      },
      {
        id: 'wl-outstation',
        requires_vehicle_selection: false,
        requires_outstation_details: true,
      },
      {
        id: 'wl-office',
        requires_vehicle_selection: false,
        requires_outstation_details: false,
      },
    ])

    mocks.getBaseLocationDayTypeByCode.mockImplementation(
      (_supabase: unknown, code: string) => {
        if (code === 'HALF_DAY') {
          return Promise.resolve({
            day_type_code: 'HALF_DAY',
            day_type_label: 'Half Day (Fuel Only)',
            include_food_allowance: false,
            is_default: false,
            display_order: 2,
            is_active: true,
          })
        }

        if (code === 'FULL_DAY') {
          return Promise.resolve({
            day_type_code: 'FULL_DAY',
            day_type_label: 'Full Day',
            include_food_allowance: true,
            is_default: true,
            display_order: 1,
            is_active: true,
          })
        }

        return Promise.resolve(null)
      }
    )
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
    mocks.getVehicleTypeById.mockResolvedValue({
      vehicle_name: 'Two Wheeler',
      max_km_round_trip: 150,
    })

    mocks.calculateBaseLocationItems.mockResolvedValue({
      items: [{ expense_type: 'FUEL', amount: 180, description: 'Fuel' }],
      total: 180,
    })

    mocks.calculateOutstationTravelItems.mockResolvedValue({
      items: [
        { expense_type: 'FUEL', amount: 500, description: 'Intercity fuel' },
      ],
      total: 500,
    })

    mocks.getFoodWithPrincipalsLimit.mockResolvedValue(100)
    mocks.countFoodWithPrincipalsInMonth.mockResolvedValue(0)

    mocks.insertClaim.mockResolvedValue({
      id: 'claim-new-1',
      claim_number: 'CLAIM-20260306-001',
    })
    mocks.insertClaimItems.mockResolvedValue(undefined)
  })

  it('should reject unknown work locations', async () => {
    const result = await submitClaimAction({
      claimDate: '06/03/2026',
      workLocation: 'wl-missing',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Unknown work location.')
  })

  it('should require vehicle type for base location claims', async () => {
    const result = await submitClaimAction({
      claimDate: '06/03/2026',
      workLocation: 'wl-base',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe(
      'Vehicle type is required for this work location.'
    )
  })

  it('should reject invalid base day type codes', async () => {
    const result = await submitClaimAction({
      ...BASE_LOCATION_INPUT,
      baseLocationDayTypeCode: 'INVALID',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Selected day type is not available.')
    expect(mocks.calculateBaseLocationItems).not.toHaveBeenCalled()
  })

  it('should pass fuel-only includeFood flag for half day base claims', async () => {
    const result = await submitClaimAction({
      ...BASE_LOCATION_INPUT,
      baseLocationDayTypeCode: 'HALF_DAY',
    })

    expect(result.ok).toBe(true)
    expect(mocks.calculateBaseLocationItems).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        includeFoodAllowance: false,
      })
    )
    expect(mocks.insertClaim).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        baseLocationDayTypeCode: 'HALF_DAY',
      })
    )
  })

  it('should require explicit inter-city own-vehicle selection for outstation claims', async () => {
    const result = await submitClaimAction({
      claimDate: '06/03/2026',
      workLocation: 'wl-outstation',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe(
      'Please select whether you travelled between cities using your own vehicle.'
    )
  })

  it('should require explicit intra-city own-vehicle selection after inter-city is no', async () => {
    const result = await submitClaimAction({
      claimDate: '06/03/2026',
      workLocation: 'wl-outstation',
      intercityOwnVehicleUsed: false,
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe(
      'Please select whether you travelled within the city using your own vehicle/rental vehicle.'
    )
  })

  it.each([
    {
      name: 'requires outstation state',
      input: { ...OUTSTATION_OWN_INPUT, outstationStateId: undefined },
      expected: 'State is required.',
    },
    {
      name: 'requires from city for outstation travel',
      input: { ...OUTSTATION_OWN_INPUT, fromCityId: undefined },
      expected: 'From city is required for outstation travel.',
    },
    {
      name: 'requires to city for outstation travel',
      input: { ...OUTSTATION_OWN_INPUT, toCityId: undefined },
      expected: 'To city is required for outstation travel.',
    },
    {
      name: 'requires own-vehicle type',
      input: { ...OUTSTATION_OWN_INPUT, vehicleType: undefined },
      expected: 'Vehicle type is required when using own vehicle.',
    },
    {
      name: 'requires positive km for own vehicle',
      input: { ...OUTSTATION_OWN_INPUT, kmTravelled: 0 },
      expected: 'KM travelled must be greater than zero.',
    },
  ])('should enforce outstation fields: $name', async ({ input, expected }) => {
    const result = await submitClaimAction(input as never)
    expect(result.ok).toBe(false)
    expect(result.error).toBe(expected)
  })

  it('should allow no-own-vehicle outstation claim', async () => {
    const result = await submitClaimAction({
      ...OUTSTATION_NO_OWN_VEHICLE_INPUT,
    })

    expect(result.ok).toBe(true)
    expect(mocks.calculateOutstationTravelItems).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        hasIntercityTravel: false,
        intercityOwnVehicleUsed: false,
      })
    )
  })

  it('should allow outstation claim when both own-vehicle options are no', async () => {
    const result = await submitClaimAction({
      ...OUTSTATION_NO_OWN_VEHICLE_INPUT,
    })

    expect(result.ok).toBe(true)
    expect(mocks.calculateOutstationTravelItems).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        hasIntercityTravel: false,
        hasIntracityTravel: false,
        intercityOwnVehicleUsed: false,
        intracityOwnVehicleUsed: false,
      })
    )
    expect(mocks.insertClaim).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ownVehicleUsed: false,
        vehicleTypeId: null,
        outstationStateId: null,
        outstationCityId: null,
        fromCityId: null,
        toCityId: null,
        kmTravelled: null,
      })
    )
  })

  it('should block own-vehicle outstation claims above km limit', async () => {
    const result = await submitClaimAction({
      ...OUTSTATION_OWN_INPUT,
      kmTravelled: 220,
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('exceeds max limit')
    expect(mocks.calculateOutstationTravelItems).not.toHaveBeenCalled()
  })

  it('should enforce food with principals eligibility and monthly cap', async () => {
    mocks.getFoodWithPrincipalsLimit.mockResolvedValueOnce(0)
    const ineligibleResult = await submitClaimAction({
      ...OUTSTATION_OWN_INPUT,
      foodWithPrincipalsAmount: 500,
    })

    expect(ineligibleResult.ok).toBe(false)
    expect(ineligibleResult.error).toBe(
      'Your designation is not eligible for Food with Principals.'
    )

    mocks.getFoodWithPrincipalsLimit.mockResolvedValueOnce(500)
    mocks.countFoodWithPrincipalsInMonth.mockResolvedValueOnce(5)

    const limitResult = await submitClaimAction({
      ...OUTSTATION_OWN_INPUT,
      foodWithPrincipalsAmount: 500,
    })

    expect(limitResult.ok).toBe(false)
    expect(limitResult.error).toContain('maximum 5 times per month')
  })

  it('should surface workflow bootstrap errors from approval-flow configuration', async () => {
    mocks.getEmployeeByEmail.mockResolvedValueOnce({
      id: 'emp-1',
      designation_id: null,
    })

    const missingDesignation = await submitClaimAction(BASE_LOCATION_INPUT)
    expect(missingDesignation.ok).toBe(false)
    expect(missingDesignation.error).toBe(
      'Employee designation is required to submit claims.'
    )

    mocks.getDesignationApprovalFlow.mockResolvedValueOnce({
      required_approval_levels: [99],
    })

    const unsupportedLevel = await submitClaimAction(BASE_LOCATION_INPUT)
    expect(unsupportedLevel.ok).toBe(false)
    expect(unsupportedLevel.error).toContain(
      'No active pending claim status found for approval level 99'
    )
  })

  it('should return default workflow start message on non-Error failures', async () => {
    mocks.getDesignationApprovalFlow.mockRejectedValueOnce('db-offline')

    const result = await submitClaimAction(BASE_LOCATION_INPUT)

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Unable to start workflow.')
  })

  it('should map expense items for standard and no-own-vehicle submissions', async () => {
    const standardResult = await submitClaimAction(BASE_LOCATION_INPUT)
    expect(standardResult.ok).toBe(true)

    expect(mocks.insertClaimItems).toHaveBeenCalledWith(expect.anything(), [
      {
        claimId: 'claim-new-1',
        itemType: 'FUEL',
        amount: 180,
        description: 'Fuel',
      },
    ])

    await submitClaimAction(OUTSTATION_NO_OWN_VEHICLE_INPUT)

    expect(mocks.calculateOutstationTravelItems).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        hasIntercityTravel: false,
        intercityOwnVehicleUsed: false,
      })
    )
    expect(mocks.insertClaim).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ownVehicleUsed: false,
        hasIntercityTravel: false,
        hasIntracityTravel: false,
        intercityOwnVehicleUsed: null,
        intracityOwnVehicleUsed: null,
        vehicleTypeId: null,
        outstationStateId: null,
        outstationCityId: null,
        fromCityId: null,
        toCityId: null,
        kmTravelled: null,
      })
    )
  })

  it('should keep defensive vehicleType guard for inconsistent config flags', async () => {
    let readCount = 0

    mocks.getAllWorkLocations.mockResolvedValueOnce([
      {
        id: 'wl-inconsistent',
        get requires_vehicle_selection() {
          readCount += 1
          return readCount > 1
        },
        requires_outstation_details: false,
      },
    ])

    const result = await submitClaimAction({
      claimDate: '06/03/2026',
      workLocation: 'wl-inconsistent',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe(
      'Vehicle type is required for this work location.'
    )
  })

  it('should map expense items for resubmitted replacement claims', async () => {
    mocks.getClaimForDate.mockResolvedValueOnce({
      id: 'claim-old-rejected',
      claim_number: 'CLAIM-20260306-0001',
      status_code: 'REJECTED',
      current_approval_level: null,
      is_rejection: true,
      is_terminal: true,
      allow_resubmit: true,
      is_superseded: false,
    })

    mocks.insertClaim.mockResolvedValueOnce({
      id: 'claim-refile-1',
      claim_number: 'CLAIM-20260306-0002',
    })

    const result = await submitClaimAction(BASE_LOCATION_INPUT)

    expect(result.ok).toBe(true)
    expect(rpcMock).toHaveBeenCalledWith('supersede_rejected_claim', {
      p_claim_id: 'claim-old-rejected',
    })
    expect(mocks.insertClaimItems).toHaveBeenCalledWith(expect.anything(), [
      {
        claimId: 'claim-refile-1',
        itemType: 'FUEL',
        amount: 180,
        description: 'Fuel',
      },
    ])
  })

  it('should persist own-vehicle outstation fields for standard submissions', async () => {
    const result = await submitClaimAction({
      ...OUTSTATION_OWN_INPUT,
      foodWithPrincipalsAmount: 0,
    })

    expect(result.ok).toBe(true)
    expect(mocks.calculateOutstationTravelItems).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        hasIntercityTravel: true,
        hasIntracityTravel: true,
        intercityOwnVehicleUsed: true,
        intracityOwnVehicleUsed: true,
      })
    )
    expect(mocks.insertClaim).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ownVehicleUsed: true,
        hasIntercityTravel: true,
        hasIntracityTravel: true,
        intercityOwnVehicleUsed: true,
        intracityOwnVehicleUsed: true,
        vehicleTypeId: 'veh-2w',
        outstationStateId: 'state-tg',
        outstationCityId: 'city-b',
        fromCityId: 'city-a',
        toCityId: 'city-b',
        kmTravelled: 100,
        accommodationNights: null,
        foodWithPrincipalsAmount: 0,
      })
    )
  })

  it('should persist own-vehicle outstation fields for replacement submissions', async () => {
    mocks.getClaimForDate.mockResolvedValueOnce({
      id: 'claim-old-rejected-own',
      claim_number: 'CLAIM-20260306-0003',
      status_code: 'REJECTED',
      current_approval_level: null,
      is_rejection: true,
      is_terminal: true,
      allow_resubmit: true,
      is_superseded: false,
    })

    mocks.insertClaim.mockResolvedValueOnce({
      id: 'claim-refile-own-1',
      claim_number: 'CLAIM-20260306-0004',
    })

    const result = await submitClaimAction({
      ...OUTSTATION_OWN_INPUT,
      foodWithPrincipalsAmount: 0,
    })

    expect(result.ok).toBe(true)
    expect(mocks.insertClaim).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ownVehicleUsed: true,
        hasIntercityTravel: true,
        hasIntracityTravel: true,
        intercityOwnVehicleUsed: true,
        intracityOwnVehicleUsed: true,
        vehicleTypeId: 'veh-2w',
        outstationStateId: 'state-tg',
        outstationCityId: 'city-b',
        fromCityId: 'city-a',
        toCityId: 'city-b',
        kmTravelled: 100,
        accommodationNights: null,
        foodWithPrincipalsAmount: 0,
      })
    )
  })
})
