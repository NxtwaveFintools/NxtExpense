import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  isAdminUser: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  searchClaimsForAdmin: vi.fn(),
  searchEmployeesForAdmin: vi.fn(),
  getMaxNotesLength: vi.fn(),
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

vi.mock('@/lib/services/system-settings-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/services/system-settings-service')
  >('@/lib/services/system-settings-service')

  return {
    ...actual,
    getMaxNotesLength: mocks.getMaxNotesLength,
  }
})

import {
  reassignApproversAction,
  rollbackClaimStatusAction,
  searchClaimsAction,
  searchEmployeesAction,
  toggleDesignationActiveAction,
  toggleExpenseRateActiveAction,
  toggleVehicleTypeActiveAction,
  toggleWorkLocationActiveAction,
  updateExpenseRateAction,
  updateVehicleRatesAction,
} from '@/features/admin/actions'

describe('admin actions integration', () => {
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

    mocks.searchClaimsForAdmin.mockResolvedValue([
      {
        id: 'claim-1',
        claim_number: 'CLAIM-001',
      },
    ])

    mocks.searchEmployeesForAdmin.mockResolvedValue([
      {
        id: 'emp-1',
        employee_name: 'Yohan',
      },
    ])

    mocks.getMaxNotesLength.mockResolvedValue(500)
  })

  it('should execute rollback RPC and return rolled back status details', async () => {
    // Arrange
    rpcMock.mockResolvedValue({
      data: [
        { claim_id: 'claim-1', rolled_back_to: 'L3_PENDING_FINANCE_REVIEW' },
      ],
      error: null,
    })

    // Act
    const result = await rollbackClaimStatusAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      reason: 'Rollback for audit correction',
      confirmation: 'CONFIRM',
    })

    // Assert
    expect(result).toEqual({
      ok: true,
      error: null,
      claimId: 'claim-1',
      rolledBackTo: 'L3_PENDING_FINANCE_REVIEW',
    })
    expect(rpcMock).toHaveBeenCalledWith('admin_rollback_claim_atomic', {
      p_claim_id: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      p_reason: 'Rollback for audit correction',
      p_confirmation: 'CONFIRM',
    })
  })

  it('should reject rollback for unauthorized users', async () => {
    // Arrange
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      rpc: rpcMock,
      from: fromMock,
    })

    // Act
    const result = await rollbackClaimStatusAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      reason: 'Rollback for audit correction',
      confirmation: 'CONFIRM',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Unauthorized request.')
  })

  it('should handle rollback RPC failures gracefully', async () => {
    // Arrange
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Claim cannot be rolled back from current state.' },
    })

    // Act
    const result = await rollbackClaimStatusAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      reason: 'Rollback for audit correction',
      confirmation: 'CONFIRM',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Claim cannot be rolled back from current state.')
  })

  it('should execute approver reassignment and return impacted claims count', async () => {
    // Arrange
    rpcMock.mockResolvedValue({ data: 3, error: null })

    // Act
    const result = await reassignApproversAction({
      employeeId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      approvalLevel1: 'manager@nxtwave.co.in',
      approvalLevel2: undefined,
      approvalLevel3: 'mansoor@nxtwave.co.in',
      reason: 'Org hierarchy update',
      confirmation: 'CONFIRM',
    })

    // Assert
    expect(result).toEqual({ ok: true, error: null, impactedClaims: 3 })
    expect(rpcMock).toHaveBeenCalledWith(
      'admin_reassign_employee_approvers_atomic',
      {
        p_employee_id: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
        p_level_1: 'manager@nxtwave.co.in',
        p_level_2: null,
        p_level_3: 'mansoor@nxtwave.co.in',
        p_reason: 'Org hierarchy update',
        p_confirmation: 'CONFIRM',
      }
    )
  })

  it('should enforce rollback reason length from system settings', async () => {
    // Arrange
    mocks.getMaxNotesLength.mockResolvedValueOnce(10)

    // Act
    const result = await rollbackClaimStatusAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      reason: 'This reason is too long.',
      confirmation: 'CONFIRM',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Rollback reason cannot exceed 10 characters.')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('should enforce reassignment reason length from system settings', async () => {
    // Arrange
    mocks.getMaxNotesLength.mockResolvedValueOnce(10)

    // Act
    const result = await reassignApproversAction({
      employeeId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      reason: 'This reason is too long.',
      confirmation: 'CONFIRM',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe(
      'Reassignment reason cannot exceed 10 characters.'
    )
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('should reject non-admin users for reassignment', async () => {
    // Arrange
    mocks.isAdminUser.mockResolvedValue(false)

    // Act
    const result = await reassignApproversAction({
      employeeId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      reason: 'Org hierarchy update',
      confirmation: 'CONFIRM',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Admin access is required.')
  })

  it('should search claims successfully for admin users', async () => {
    // Act
    const result = await searchClaimsAction('CLAIM-001')

    // Assert
    expect(result.ok).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(mocks.searchClaimsForAdmin).toHaveBeenCalledWith(
      expect.anything(),
      'CLAIM-001'
    )
  })

  it('should search employees successfully for admin users', async () => {
    // Act
    const result = await searchEmployeesAction('Yohan')

    // Assert
    expect(result.ok).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(mocks.searchEmployeesForAdmin).toHaveBeenCalledWith(
      expect.anything(),
      'Yohan'
    )
  })

  it('should return search failure payload when admin context fails', async () => {
    // Arrange
    mocks.getEmployeeByEmail.mockResolvedValue(null)

    // Act
    const claimsResult = await searchClaimsAction('CLAIM-001')
    const employeesResult = await searchEmployeesAction('Yohan')

    // Assert
    expect(claimsResult.ok).toBe(false)
    expect(claimsResult.data).toEqual([])
    expect(employeesResult.ok).toBe(false)
    expect(employeesResult.data).toEqual([])
  })

  it('should update designation active flag in database', async () => {
    // Act
    const result = await toggleDesignationActiveAction({
      id: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      isActive: false,
    })

    // Assert
    expect(result).toEqual({ ok: true, error: null })
    expect(fromMock).toHaveBeenCalledWith('designations')
    expect(updateMock).toHaveBeenCalledWith({ is_active: false })
    expect(eqMock).toHaveBeenCalledWith(
      'id',
      '5db22d75-b209-4f30-b5c8-f4f27ebee9e8'
    )
  })

  it('should surface DB errors while toggling work locations', async () => {
    // Arrange
    eqMock.mockResolvedValueOnce({
      error: { message: 'Work location update failed.' },
    })

    // Act
    const result = await toggleWorkLocationActiveAction({
      id: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      isActive: true,
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Work location update failed.')
  })

  it('should update vehicle type active flag and vehicle rates', async () => {
    // Act
    const toggleResult = await toggleVehicleTypeActiveAction({
      id: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      isActive: true,
    })

    const ratesResult = await updateVehicleRatesAction({
      id: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      baseFuelRatePerDay: 300,
      intercityRatePerKm: 8,
      maxKmRoundTrip: 300,
    })

    // Assert
    expect(toggleResult.ok).toBe(true)
    expect(ratesResult.ok).toBe(true)
    expect(fromMock).toHaveBeenCalledWith('vehicle_types')
  })

  it('should update and toggle expense rates', async () => {
    // Act
    const updateResult = await updateExpenseRateAction({
      id: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      rateAmount: 420,
    })

    const toggleResult = await toggleExpenseRateActiveAction({
      id: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      isActive: false,
    })

    // Assert
    expect(updateResult.ok).toBe(true)
    expect(toggleResult.ok).toBe(true)
    expect(fromMock).toHaveBeenCalledWith('expense_rates')
  })
})
