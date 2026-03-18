import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  isFinanceTeamMember: vi.fn(),
  getFinanceQueuePaginated: vi.fn(),
  getFinanceHistoryPaginated: vi.fn(),
  getClaimAvailableActions: vi.fn(),
  normalizeFinanceFilters: vi.fn(),
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
  }
})

vi.mock('@/features/finance/permissions', () => ({
  isFinanceTeamMember: mocks.isFinanceTeamMember,
}))

vi.mock('@/features/finance/queries', () => ({
  getFinanceQueuePaginated: mocks.getFinanceQueuePaginated,
  getFinanceHistoryPaginated: mocks.getFinanceHistoryPaginated,
}))

vi.mock('@/features/claims/queries', () => ({
  getClaimAvailableActions: mocks.getClaimAvailableActions,
}))

vi.mock('@/features/finance/utils/filters', () => ({
  normalizeFinanceFilters: mocks.normalizeFinanceFilters,
}))

import {
  bulkFinanceClaimsAction,
  getFinanceHistoryAction,
  getFinanceQueueAction,
  submitFinanceAction,
} from '@/features/finance/actions'

describe('finance actions workflow integration', () => {
  let rpcMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    rpcMock = vi.fn().mockResolvedValue({ error: null })

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { email: 'finance@nxtwave.co.in' },
          },
        }),
      },
      rpc: rpcMock,
    })

    mocks.getEmployeeByEmail.mockResolvedValue({
      id: 'emp-finance',
      employee_email: 'finance@nxtwave.co.in',
    })

    mocks.isFinanceTeamMember.mockResolvedValue(true)

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

    mocks.getClaimAvailableActions.mockResolvedValue([
      {
        action: 'issued',
        display_label: 'Issue Payment',
        require_notes: false,
        supports_allow_resubmit: false,
        actor_scope: 'finance',
      },
      {
        action: 'finance_rejected',
        display_label: 'Reject',
        require_notes: true,
        supports_allow_resubmit: true,
        actor_scope: 'finance',
      },
    ])

    mocks.getFinanceQueuePaginated.mockResolvedValue({
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit: 10,
    })

    mocks.getFinanceHistoryPaginated.mockResolvedValue({
      data: [],
      hasNextPage: false,
      nextCursor: null,
      limit: 10,
    })
  })

  it('should transition Finance Review to Approved when finance issues claim', async () => {
    // Arrange
    const payload = {
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      action: 'issued' as const,
      notes: 'NEFT completed',
    }

    // Act
    const result = await submitFinanceAction(payload)

    // Assert
    expect(result).toEqual({ ok: true, error: null })
    expect(rpcMock).toHaveBeenCalledWith('submit_finance_action_atomic', {
      p_claim_id: payload.claimId,
      p_action: 'issued',
      p_notes: 'NEFT completed',
      p_allow_resubmit: false,
    })
  })

  it('should submit finance rejection with allowResubmit', async () => {
    // Arrange
    const payload = {
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      action: 'finance_rejected' as const,
      notes: 'Missing bank details',
      allowResubmit: true,
    }

    // Act
    const result = await submitFinanceAction(payload)

    // Assert
    expect(result.ok).toBe(true)
    expect(rpcMock).toHaveBeenCalledWith('submit_finance_action_atomic', {
      p_claim_id: payload.claimId,
      p_action: 'finance_rejected',
      p_notes: 'Missing bank details',
      p_allow_resubmit: true,
    })
  })

  it('should block Finance approval before HOD approval', async () => {
    // Arrange
    rpcMock.mockResolvedValue({
      error: {
        message: 'Cannot issue claim before approval workflow is complete.',
      },
    })

    // Act
    const result = await submitFinanceAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      action: 'issued',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe(
      'Cannot issue claim before approval workflow is complete.'
    )
  })

  it('should block finance action on rejected claims', async () => {
    // Arrange
    rpcMock.mockResolvedValue({
      error: { message: 'Rejected claims cannot be issued.' },
    })

    // Act
    const result = await submitFinanceAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      action: 'issued',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Rejected claims cannot be issued.')
  })

  it('should handle database connection failure gracefully', async () => {
    // Arrange
    mocks.createSupabaseServerClient.mockRejectedValue(
      new Error('Database connection failed')
    )

    // Act
    const result = await submitFinanceAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      action: 'issued',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Database connection failed')
  })

  it('should return fallback message for non-Error failures in submit flow', async () => {
    // Arrange
    mocks.createSupabaseServerClient.mockRejectedValue('connection-failure')

    // Act
    const result = await submitFinanceAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      action: 'issued',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Unable to submit finance action.')
  })

  it('should validate finance action payload before DB path', async () => {
    // Act
    const result = await submitFinanceAction({
      claimId: 'invalid-id',
      action: 'issued',
    } as never)

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Invalid claim identifier.')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('should process bulk finance actions for selected claims', async () => {
    // Arrange
    const payload = {
      claimIds: [
        '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
        '8d9efea6-f7c2-4b26-b8f4-2f3f65b9f84d',
      ],
      action: 'issued' as const,
      notes: 'Bulk payout release',
    }

    // Act
    const result = await bulkFinanceClaimsAction(payload)

    // Assert
    expect(result).toEqual({ ok: true, error: null })
    expect(rpcMock).toHaveBeenCalledWith('bulk_finance_actions_atomic', {
      p_claim_ids: payload.claimIds,
      p_action: 'issued',
      p_notes: 'Bulk payout release',
      p_allow_resubmit: false,
    })
  })

  it('should validate bulk payload before DB path', async () => {
    // Act
    const result = await bulkFinanceClaimsAction({
      claimIds: [],
      action: 'issued',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('should handle bulk finance RPC failure gracefully', async () => {
    // Arrange
    rpcMock.mockResolvedValue({
      error: { message: 'Bulk operation failed due to lock timeout.' },
    })

    // Act
    const result = await bulkFinanceClaimsAction({
      claimIds: ['5db22d75-b209-4f30-b5c8-f4f27ebee9e8'],
      action: 'issued',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Bulk operation failed due to lock timeout.')
  })

  it('should return fallback message for non-Error failures in bulk flow', async () => {
    // Arrange
    mocks.createSupabaseServerClient.mockRejectedValue('connection-failure')

    // Act
    const result = await bulkFinanceClaimsAction({
      claimIds: ['5db22d75-b209-4f30-b5c8-f4f27ebee9e8'],
      action: 'issued',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Unable to process selected finance claims.')
  })

  it('should throw when finance queue is requested without authenticated user', async () => {
    // Arrange
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      rpc: rpcMock,
    })

    // Act + Assert
    await expect(getFinanceQueueAction(null, 10, {})).rejects.toThrow(
      'Unauthorized request.'
    )
  })

  it('should throw when user is not a finance team member', async () => {
    // Arrange
    mocks.isFinanceTeamMember.mockResolvedValue(false)

    // Act + Assert
    await expect(getFinanceQueueAction(null, 10, {})).rejects.toThrow(
      'Finance access is required.'
    )
  })

  it('should throw when employee profile is missing for finance context', async () => {
    // Arrange
    mocks.getEmployeeByEmail.mockResolvedValue(null)

    // Act + Assert
    await expect(getFinanceHistoryAction(null, 10, {})).rejects.toThrow(
      'Finance access is required.'
    )
  })

  it('should load finance queue with normalized filters', async () => {
    // Arrange
    const rawFilters = {
      employeeName: 'Yohan',
      claimStatus: '3ae9b558-c006-427d-8ce6-13057d438d17',
    }

    // Act
    await getFinanceQueueAction('cursor-1', 25, rawFilters)

    // Assert
    expect(mocks.normalizeFinanceFilters).toHaveBeenCalledWith(rawFilters)
    expect(mocks.getFinanceQueuePaginated).toHaveBeenCalledWith(
      expect.anything(),
      'cursor-1',
      25,
      {
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
      }
    )
  })

  it('should load finance history with normalized filters', async () => {
    // Act
    await getFinanceHistoryAction(null, 10, {
      actionFilter: 'finance_rejected',
    })

    // Assert
    expect(mocks.getFinanceHistoryPaginated).toHaveBeenCalledWith(
      expect.anything(),
      null,
      10,
      {
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
      }
    )
  })
})
