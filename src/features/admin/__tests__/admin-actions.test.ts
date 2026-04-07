import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  isAdminUser: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  searchClaimsForAdmin: vi.fn(),
  searchEmployeesForAdmin: vi.fn(),
  getMaxNotesLength: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import {
  changeClaimStatusAction,
  createEmployeeAction,
  getEmployeeFormOptionsAction,
  prepareEmployeeReplacementAction,
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

    mocks.createSupabaseAdminClient.mockReturnValue({
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'auth-user-default' } },
            error: null,
          }),
          deleteUser: vi.fn().mockResolvedValue({ error: null }),
        },
      },
    })
  })

  it('should execute status change RPC and return updated status details', async () => {
    // Arrange
    rpcMock.mockResolvedValue({
      data: [
        {
          claim_id: 'claim-1',
          previous_status_code: 'L3_PENDING_FINANCE_REVIEW',
          updated_status_code: 'L2_PENDING',
        },
      ],
      error: null,
    })

    // Act
    const result = await changeClaimStatusAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      targetStatusId: '3f7ef18e-2aaf-4f40-a6f7-61f1582f5374',
      reason: 'Reset to L2 pending for re-approval',
      confirmation: 'CONFIRM',
    })

    // Assert
    expect(result).toEqual({
      ok: true,
      error: null,
      claimId: 'claim-1',
      previousStatusCode: 'L3_PENDING_FINANCE_REVIEW',
      updatedStatusCode: 'L2_PENDING',
    })
    expect(rpcMock).toHaveBeenCalledWith(
      'admin_change_claim_status_with_audit_atomic',
      {
        p_claim_id: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
        p_target_status_id: '3f7ef18e-2aaf-4f40-a6f7-61f1582f5374',
        p_reason: 'Reset to L2 pending for re-approval',
        p_confirmation: 'CONFIRM',
      }
    )
  })

  it('should reject status change for unauthorized users', async () => {
    // Arrange
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      rpc: rpcMock,
      from: fromMock,
    })

    // Act
    const result = await changeClaimStatusAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      targetStatusId: '3f7ef18e-2aaf-4f40-a6f7-61f1582f5374',
      reason: 'Reset to L2 pending for re-approval',
      confirmation: 'CONFIRM',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Unauthorized request.')
  })

  it('should handle status-change RPC failures gracefully', async () => {
    // Arrange
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Claim status change is not allowed for this target.' },
    })

    // Act
    const result = await changeClaimStatusAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      targetStatusId: '3f7ef18e-2aaf-4f40-a6f7-61f1582f5374',
      reason: 'Reset to L2 pending for re-approval',
      confirmation: 'CONFIRM',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe(
      'Claim status change is not allowed for this target.'
    )
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
      'admin_reassign_employee_approvers_with_audit_atomic',
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

  it('should enforce status-change reason length from system settings', async () => {
    // Arrange
    mocks.getMaxNotesLength.mockResolvedValueOnce(10)

    // Act
    const result = await changeClaimStatusAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      targetStatusId: '3f7ef18e-2aaf-4f40-a6f7-61f1582f5374',
      reason: 'This reason is too long.',
      confirmation: 'CONFIRM',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe(
      'Status change reason cannot exceed 10 characters.'
    )
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
    expect(rpcMock).toHaveBeenCalledWith(
      'admin_toggle_designation_active_atomic',
      {
        p_id: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
        p_is_active: false,
      }
    )
  })

  it('should surface DB errors while toggling work locations', async () => {
    // Arrange
    rpcMock.mockResolvedValueOnce({
      data: null,
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
    expect(rpcMock).toHaveBeenNthCalledWith(
      1,
      'admin_toggle_vehicle_type_active_atomic',
      {
        p_id: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
        p_is_active: true,
      }
    )
    expect(rpcMock).toHaveBeenNthCalledWith(
      2,
      'admin_update_vehicle_rates_atomic',
      {
        p_id: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
        p_base_fuel_rate_per_day: 300,
        p_intercity_rate_per_km: 8,
        p_max_km_round_trip: 300,
      }
    )
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
    expect(rpcMock).toHaveBeenNthCalledWith(
      1,
      'admin_update_expense_rate_amount_atomic',
      {
        p_id: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
        p_rate_amount: 420,
      }
    )
    expect(rpcMock).toHaveBeenNthCalledWith(
      2,
      'admin_toggle_expense_rate_active_atomic',
      {
        p_id: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
        p_is_active: false,
      }
    )
  })

  it('should create employee through admin RPC', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          id: 'emp-created',
          employee_id: 'NXT-EMP-1001',
          employee_name: 'New Employee',
          employee_email: 'new.employee@nxtwave.co.in',
        },
      ],
      error: null,
    })

    const result = await createEmployeeAction({
      employeeId: 'NXT-EMP-1001',
      employeeName: 'New Employee',
      employeeEmail: 'new.employee@nxtwave.co.in',
      designationId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      employeeStatusId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      roleId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      stateId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
    })

    expect(result.ok).toBe(true)
    expect(rpcMock).toHaveBeenCalledWith('admin_create_employee_atomic', {
      p_employee_id: 'NXT-EMP-1001',
      p_employee_name: 'New Employee',
      p_employee_email: 'new.employee@nxtwave.co.in',
      p_designation_id: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      p_employee_status_id: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      p_role_id: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      p_state_id: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      p_approval_employee_id_level_1: null,
      p_approval_employee_id_level_2: null,
      p_approval_employee_id_level_3: null,
    })
  })

  it('should provision auth credentials when optional login password is provided', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          id: 'emp-created',
          employee_id: 'NXT-EMP-1002',
          employee_name: 'Pwd Employee',
          employee_email: 'pwd.employee@nxtwave.co.in',
        },
      ],
      error: null,
    })

    const createUserMock = vi.fn().mockResolvedValue({ data: {}, error: null })
    mocks.createSupabaseAdminClient.mockReturnValueOnce({
      auth: {
        admin: {
          createUser: createUserMock,
        },
      },
    })

    const result = await createEmployeeAction({
      employeeId: 'NXT-EMP-1002',
      employeeName: 'Pwd Employee',
      employeeEmail: 'pwd.employee@nxtwave.co.in',
      loginPassword: 'test1234',
      designationId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      employeeStatusId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      roleId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      stateId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
    })

    expect(result.ok).toBe(true)
    expect(createUserMock).toHaveBeenCalledWith({
      email: 'pwd.employee@nxtwave.co.in',
      password: 'test1234',
      email_confirm: true,
    })
  })

  it('should fail create employee when auth credential provisioning fails', async () => {
    const createUserMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'User already registered' },
    })

    mocks.createSupabaseAdminClient.mockReturnValueOnce({
      auth: {
        admin: {
          createUser: createUserMock,
        },
      },
    })

    const result = await createEmployeeAction({
      employeeId: 'NXT-EMP-1003',
      employeeName: 'Duplicate User',
      employeeEmail: 'duplicate@nxtwave.co.in',
      loginPassword: 'test1234',
      designationId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      employeeStatusId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      roleId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      stateId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Unable to create login credentials')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('should rollback provisioned auth user when employee RPC fails', async () => {
    const createUserMock = vi.fn().mockResolvedValue({
      data: { user: { id: 'auth-user-rollback' } },
      error: null,
    })
    const deleteUserMock = vi.fn().mockResolvedValue({ error: null })

    mocks.createSupabaseAdminClient.mockReturnValue({
      auth: {
        admin: {
          createUser: createUserMock,
          deleteUser: deleteUserMock,
        },
      },
    })

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'Employee ID already exists.' },
    })

    const result = await createEmployeeAction({
      employeeId: 'NXT-EMP-1004',
      employeeName: 'Rollback User',
      employeeEmail: 'rollback@nxtwave.co.in',
      loginPassword: 'test1234',
      designationId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      employeeStatusId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      roleId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      stateId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Employee ID already exists.')
    expect(deleteUserMock).toHaveBeenCalledWith('auth-user-rollback')
  })

  it('should fetch employee form options for admin', async () => {
    const tableRows: Record<string, unknown[]> = {
      designations: [
        {
          id: 'd1',
          designation_name: 'State Business Head',
          designation_code: 'SBH',
        },
      ],
      employee_statuses: [
        { id: 's1', status_name: 'Active', status_code: 'ACTIVE' },
      ],
      roles: [{ id: 'r1', role_name: 'Admin', role_code: 'ADMIN' }],
      states: [{ id: 'st1', state_name: 'Telangana', state_code: 'TG' }],
      approver_selection_rules: [
        {
          approval_level: 1,
          designations: {
            designation_name: 'State Business Head',
          },
        },
      ],
    }

    const fromLookup = vi.fn().mockImplementation((table: string) => ({
      select: vi.fn().mockImplementation(() => {
        if (
          table === 'designations' ||
          table === 'roles' ||
          table === 'states'
        ) {
          return {
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: tableRows[table] ?? [],
                error: null,
              }),
            }),
          }
        }

        if (table === 'approver_selection_rules') {
          return {
            eq: vi
              .fn()
              .mockResolvedValue({ data: tableRows[table] ?? [], error: null }),
          }
        }

        return {
          order: vi
            .fn()
            .mockResolvedValue({ data: tableRows[table] ?? [], error: null }),
        }
      }),
    }))

    mocks.createSupabaseServerClient.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { email: 'admin@nxtwave.co.in' },
          },
        }),
      },
      from: fromLookup,
      rpc: rpcMock,
    })

    const result = await getEmployeeFormOptionsAction()

    expect(result.ok).toBe(true)
    expect(result.data?.designations).toHaveLength(1)
    expect(result.data?.roles).toHaveLength(1)
    expect(result.data?.states).toHaveLength(1)
  })

  it('should prepare employee replacement and return replacement draft defaults', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          old_employee_id: 'old-emp-id',
          old_employee_name: 'Old Employee',
          default_designation_id: 'desig-1',
          default_role_id: 'role-1',
          default_state_id: 'state-1',
        },
      ],
      error: null,
    })

    const result = await prepareEmployeeReplacementAction({
      employeeId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      reason: 'Backfill for attrition',
      confirmation: 'CONFIRM',
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      oldEmployeeId: 'old-emp-id',
      oldEmployeeName: 'Old Employee',
      defaultDesignationId: 'desig-1',
      defaultRoleId: 'role-1',
      defaultStateId: 'state-1',
      reason: 'Backfill for attrition',
    })
    expect(rpcMock).toHaveBeenCalledWith(
      'admin_prepare_employee_replacement_atomic',
      {
        p_employee_id: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
        p_reason: 'Backfill for attrition',
        p_confirmation: 'CONFIRM',
      }
    )
  })
})
