import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  isAdminUser: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  searchClaimsForAdmin: vi.fn(),
  searchEmployeesForAdmin: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/admin/permissions', () => ({
  isAdminUser: mocks.isAdminUser,
}))

vi.mock('@/lib/services/employee-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/services/employee-service')
  >('@/lib/services/employee-service')

  return {
    ...actual,
    getEmployeeByEmail: mocks.getEmployeeByEmail,
  }
})

vi.mock('@/features/admin/queries', () => ({
  searchClaimsForAdmin: mocks.searchClaimsForAdmin,
  searchEmployeesForAdmin: mocks.searchEmployeesForAdmin,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import {
  changeClaimStatusAction,
  reassignApproversAction,
  searchClaimsAction,
  searchEmployeesAction,
  toggleDesignationActiveAction,
  toggleExpenseRateActiveAction,
  toggleVehicleTypeActiveAction,
  toggleWorkLocationActiveAction,
  updateExpenseRateAction,
  updateVehicleRatesAction,
} from '@/features/admin/actions'

const VALID_ID = '5db22d75-b209-4f30-b5c8-f4f27ebee9e8'
const VALID_EMAIL = 'manager@nxtwave.co.in'

describe('admin action branch coverage', () => {
  let rpcMock: ReturnType<typeof vi.fn>
  let fromMock: ReturnType<typeof vi.fn>
  let updateMock: ReturnType<typeof vi.fn>
  let eqMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    rpcMock = vi.fn().mockResolvedValue({ data: null, error: null })
    eqMock = vi.fn().mockResolvedValue({ error: null })
    updateMock = vi.fn().mockReturnValue({ eq: eqMock })
    fromMock = vi.fn().mockReturnValue({ update: updateMock })

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { email: 'admin@nxtwave.co.in' },
          },
        }),
      },
      rpc: rpcMock,
      from: fromMock,
    })

    mocks.getEmployeeByEmail.mockResolvedValue({
      id: 'emp-admin',
      employee_email: 'admin@nxtwave.co.in',
    })

    mocks.isAdminUser.mockResolvedValue(true)
    mocks.searchClaimsForAdmin.mockResolvedValue([])
    mocks.searchEmployeesForAdmin.mockResolvedValue([])
  })

  it('should short-circuit invalid payloads before DB calls', async () => {
    const statusChange = await changeClaimStatusAction({
      claimId: 'invalid-id',
      targetStatusId: VALID_ID,
      reason: 'Invalid',
      confirmation: 'CONFIRM',
    } as never)

    const reassign = await reassignApproversAction({
      employeeId: 'invalid-id',
      approvalLevel1: VALID_EMAIL,
      reason: 'Invalid',
      confirmation: 'CONFIRM',
    } as never)

    const designation = await toggleDesignationActiveAction({
      id: 'invalid-id',
      isActive: true,
    } as never)

    const workLocation = await toggleWorkLocationActiveAction({
      id: 'invalid-id',
      isActive: true,
    } as never)

    const vehicle = await toggleVehicleTypeActiveAction({
      id: 'invalid-id',
      isActive: true,
    } as never)

    const vehicleRates = await updateVehicleRatesAction({
      id: 'invalid-id',
      baseFuelRatePerDay: 300,
      intercityRatePerKm: 8,
      maxKmRoundTrip: 300,
    } as never)

    const expenseRate = await updateExpenseRateAction({
      id: 'invalid-id',
      rateAmount: 420,
    } as never)

    const expenseToggle = await toggleExpenseRateActiveAction({
      id: 'invalid-id',
      isActive: false,
    } as never)

    for (const result of [
      statusChange,
      reassign,
      designation,
      workLocation,
      vehicle,
      vehicleRates,
      expenseRate,
      expenseToggle,
    ]) {
      expect(result.ok).toBe(false)
      expect(result.error).toBeTruthy()
    }

    expect(rpcMock).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('should return empty status-change details when RPC returns non-array data', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    const result = await changeClaimStatusAction({
      claimId: VALID_ID,
      targetStatusId: VALID_ID,
      reason: 'Status change for edge-path validation',
      confirmation: 'CONFIRM',
    })

    expect(result).toEqual({
      ok: true,
      error: null,
      claimId: undefined,
      previousStatusCode: undefined,
      updatedStatusCode: undefined,
    })
  })

  it('should default reassignment impacted claims to zero for non-numeric RPC data', async () => {
    rpcMock.mockResolvedValueOnce({ data: { count: 2 }, error: null })

    const result = await reassignApproversAction({
      employeeId: VALID_ID,
      reason: 'Reassign for branch coverage',
      confirmation: 'CONFIRM',
    })

    expect(result).toEqual({ ok: true, error: null, impactedClaims: 0 })
  })

  it('should surface reassignment RPC errors', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'Reassignment is blocked for finalized workflow.' },
    })

    const result = await reassignApproversAction({
      employeeId: VALID_ID,
      reason: 'Reassignment error path',
      confirmation: 'CONFIRM',
      approvalLevel1: VALID_EMAIL,
    })

    expect(result).toEqual({
      ok: false,
      error: 'Reassignment is blocked for finalized workflow.',
    })
  })

  it('should update work location active flag on success path', async () => {
    const result = await toggleWorkLocationActiveAction({
      id: VALID_ID,
      isActive: true,
    })

    expect(result).toEqual({ ok: true, error: null })
    expect(rpcMock).toHaveBeenCalledWith(
      'admin_toggle_work_location_active_atomic',
      {
        p_id: VALID_ID,
        p_is_active: true,
      }
    )
  })

  it('should return default non-Error fallback messages for admin actions', async () => {
    mocks.createSupabaseServerClient.mockRejectedValueOnce('offline')
    const statusChange = await changeClaimStatusAction({
      claimId: VALID_ID,
      targetStatusId: VALID_ID,
      reason: 'Status change fallback',
      confirmation: 'CONFIRM',
    })
    expect(statusChange.error).toBe('Unable to change claim status.')

    mocks.createSupabaseServerClient.mockRejectedValueOnce('offline')
    const reassign = await reassignApproversAction({
      employeeId: VALID_ID,
      reason: 'Reassign fallback',
      confirmation: 'CONFIRM',
      approvalLevel1: VALID_EMAIL,
    })
    expect(reassign.error).toBe('Unable to reassign approvers.')

    mocks.createSupabaseServerClient.mockRejectedValueOnce('offline')
    const claimsSearch = await searchClaimsAction('CLAIM-001')
    expect(claimsSearch).toEqual({
      ok: false,
      error: 'Search failed.',
      data: [],
    })

    mocks.createSupabaseServerClient.mockRejectedValueOnce('offline')
    const employeesSearch = await searchEmployeesAction('admin')
    expect(employeesSearch).toEqual({
      ok: false,
      error: 'Search failed.',
      data: [],
    })
  })

  it.each([
    {
      name: 'designation toggle',
      invoke: () =>
        toggleDesignationActiveAction({
          id: VALID_ID,
          isActive: false,
        }),
      expected: 'Failed to update designation.',
    },
    {
      name: 'work location toggle',
      invoke: () =>
        toggleWorkLocationActiveAction({
          id: VALID_ID,
          isActive: false,
        }),
      expected: 'Failed to update work location.',
    },
    {
      name: 'vehicle type toggle',
      invoke: () =>
        toggleVehicleTypeActiveAction({
          id: VALID_ID,
          isActive: false,
        }),
      expected: 'Failed to update vehicle type.',
    },
    {
      name: 'vehicle rates update',
      invoke: () =>
        updateVehicleRatesAction({
          id: VALID_ID,
          baseFuelRatePerDay: 300,
          intercityRatePerKm: 8,
          maxKmRoundTrip: 300,
        }),
      expected: 'Failed to update vehicle rates.',
    },
    {
      name: 'expense rate update',
      invoke: () =>
        updateExpenseRateAction({
          id: VALID_ID,
          rateAmount: 420,
        }),
      expected: 'Failed to update expense rate.',
    },
    {
      name: 'expense rate toggle',
      invoke: () =>
        toggleExpenseRateActiveAction({
          id: VALID_ID,
          isActive: false,
        }),
      expected: 'Failed to update expense rate.',
    },
  ])(
    'should return fallback message for non-Error failures: $name',
    async ({ invoke, expected }) => {
      mocks.createSupabaseServerClient.mockRejectedValueOnce('offline')

      const result = await invoke()

      expect(result).toEqual({ ok: false, error: expected })
    }
  )

  it('should surface DB error messages for rate update actions', async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Vehicle rates update failed.' },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Expense rate update failed.' },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Expense toggle failed.' },
      })

    const vehicleRates = await updateVehicleRatesAction({
      id: VALID_ID,
      baseFuelRatePerDay: 300,
      intercityRatePerKm: 8,
      maxKmRoundTrip: 300,
    })

    const expenseRate = await updateExpenseRateAction({
      id: VALID_ID,
      rateAmount: 420,
    })

    const expenseToggle = await toggleExpenseRateActiveAction({
      id: VALID_ID,
      isActive: false,
    })

    expect(vehicleRates).toEqual({
      ok: false,
      error: 'Vehicle rates update failed.',
    })
    expect(expenseRate).toEqual({
      ok: false,
      error: 'Expense rate update failed.',
    })
    expect(expenseToggle).toEqual({
      ok: false,
      error: 'Expense toggle failed.',
    })
  })
})
