import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  getClaimWithOwner: vi.fn(),
  getPendingApprovalsPaginated: vi.fn(),
  getFilteredApprovalHistoryPaginated: vi.fn(),
  getClaimAvailableActions: vi.fn(),
  normalizeApprovalHistoryFilters: vi.fn(),
  getMaxNotesLength: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
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

vi.mock('@/features/approvals/queries', () => ({
  getClaimWithOwner: mocks.getClaimWithOwner,
  getPendingApprovalsPaginated: mocks.getPendingApprovalsPaginated,
}))

vi.mock('@/features/approvals/queries/history-filters', () => ({
  getFilteredApprovalHistoryPaginated:
    mocks.getFilteredApprovalHistoryPaginated,
}))

vi.mock('@/features/claims/queries', () => ({
  getClaimAvailableActions: mocks.getClaimAvailableActions,
}))

vi.mock('@/features/approvals/utils/history-filters', () => ({
  normalizeApprovalHistoryFilters: mocks.normalizeApprovalHistoryFilters,
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
  getApprovalHistoryAction,
  getClaimAvailableActionsAction,
  getPendingApprovalsAction,
  submitApprovalAction,
  submitBulkApprovalAction,
} from '@/features/approvals/actions'

describe('approval actions workflow integration', () => {
  let rpcMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    rpcMock = vi.fn().mockResolvedValue({ error: null })

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { email: 'approver@nxtwave.co.in' },
          },
        }),
      },
      rpc: rpcMock,
    })

    mocks.getEmployeeByEmail.mockResolvedValue({
      id: 'emp-approver',
      employee_email: 'approver@nxtwave.co.in',
    })

    mocks.getClaimWithOwner.mockResolvedValue({
      claim: { id: 'claim-1' },
      owner: { id: 'emp-owner' },
    })

    mocks.normalizeApprovalHistoryFilters.mockReturnValue({
      employeeName: null,
      claimStatus: null,
      claimDateFrom: null,
      claimDateTo: null,
      amountOperator: 'lte',
      amountValue: null,
      locationType: null,
      claimDateSort: 'desc',
      hodApprovedFrom: null,
      hodApprovedTo: null,
      financeApprovedFrom: null,
      financeApprovedTo: null,
    })

    mocks.getPendingApprovalsPaginated.mockResolvedValue({
      data: [],
      nextCursor: null,
      hasNextPage: false,
      limit: 10,
    })

    mocks.getFilteredApprovalHistoryPaginated.mockResolvedValue({
      data: [],
      nextCursor: null,
      hasNextPage: false,
      limit: 10,
    })

    mocks.getClaimAvailableActions.mockResolvedValue([
      {
        action: 'approved',
        display_label: 'Approve',
        require_notes: false,
        supports_allow_resubmit: false,
        actor_scope: 'approver',
      },
      {
        action: 'rejected',
        display_label: 'Reject',
        require_notes: true,
        supports_allow_resubmit: true,
        actor_scope: 'approver',
      },
    ])

    mocks.getMaxNotesLength.mockResolvedValue(500)
  })

  it('should submit approval and transition Submitted to SBH review', async () => {
    // Arrange
    const payload = {
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      action: 'approved' as const,
    }

    // Act
    const result = await submitApprovalAction(payload)

    // Assert
    expect(result).toEqual({ ok: true, error: null })
    expect(rpcMock).toHaveBeenCalledWith('submit_approval_action_atomic', {
      p_claim_id: 'claim-1',
      p_action: 'approved',
      p_notes: null,
      p_allow_resubmit: false,
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/approvals')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/approvals/claim-1')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/claims')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/claims/claim-1')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/finance')
  })

  it('should record approval history when SBH approves claim', async () => {
    // Arrange
    const payload = {
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      action: 'approved' as const,
      notes: 'SBH approved after reviewing receipts',
    }

    // Act
    const result = await submitApprovalAction(payload)

    // Assert
    expect(result.ok).toBe(true)
    expect(rpcMock).toHaveBeenCalledWith('submit_approval_action_atomic', {
      p_claim_id: 'claim-1',
      p_action: 'approved',
      p_notes: 'SBH approved after reviewing receipts',
      p_allow_resubmit: false,
    })
  })

  it('should pass allowResubmit when rejection action is submitted', async () => {
    // Act
    const result = await submitApprovalAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      action: 'rejected',
      notes: 'Travel proof is missing.',
      allowResubmit: true,
    })

    // Assert
    expect(result.ok).toBe(true)
    expect(rpcMock).toHaveBeenCalledWith('submit_approval_action_atomic', {
      p_claim_id: 'claim-1',
      p_action: 'rejected',
      p_notes: 'Travel proof is missing.',
      p_allow_resubmit: true,
    })
  })

  it('should block wrong approval level (EDGE-012)', async () => {
    // Arrange
    rpcMock.mockResolvedValue({
      error: { message: 'Claim is not at your approval level.' },
    })

    // Act
    const result = await submitApprovalAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      action: 'approved',
    })

    // Assert
    expect(result).toEqual({
      ok: false,
      error: 'Claim is not at your approval level.',
    })
  })

  it('should block HOD approval before SBH approval', async () => {
    // Arrange
    rpcMock.mockResolvedValue({
      error: { message: 'HOD cannot approve before SBH approval.' },
    })

    // Act
    const result = await submitApprovalAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      action: 'approved',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('HOD cannot approve before SBH approval.')
  })

  it('should block Finance approval before HOD approval', async () => {
    // Arrange
    rpcMock.mockResolvedValue({
      error: {
        message: 'Finance approval is not allowed before HOD approval.',
      },
    })

    // Act
    const result = await submitApprovalAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      action: 'approved',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe(
      'Finance approval is not allowed before HOD approval.'
    )
  })

  it('should block self approval (EDGE-013)', async () => {
    // Arrange
    rpcMock.mockResolvedValue({
      error: { message: 'Claim owner cannot approve their own claim.' },
    })

    // Act
    const result = await submitApprovalAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      action: 'approved',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Claim owner cannot approve their own claim.')
  })

  it('should block approval on rejected claims', async () => {
    // Arrange
    rpcMock.mockResolvedValue({
      error: { message: 'Rejected claims cannot be approved.' },
    })

    // Act
    const result = await submitApprovalAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      action: 'approved',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Rejected claims cannot be approved.')
  })

  it('should block approval after final approval', async () => {
    // Arrange
    rpcMock.mockResolvedValue({
      error: { message: 'Finalized claims cannot be approved again.' },
    })

    // Act
    const result = await submitApprovalAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      action: 'approved',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Finalized claims cannot be approved again.')
  })

  it('should reject invalid approval payloads before DB calls', async () => {
    // Arrange
    const payload = {
      claimId: 'invalid-uuid',
      action: 'approved' as const,
    }

    // Act
    const result = await submitApprovalAction(payload)

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Invalid claim identifier.')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('should enforce notes limit from system settings', async () => {
    // Arrange
    mocks.getMaxNotesLength.mockResolvedValueOnce(10)

    // Act
    const result = await submitApprovalAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      action: 'rejected',
      notes: 'This note is too long.',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Notes cannot exceed 10 characters.')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('should return unauthorized when session is missing', async () => {
    // Arrange
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      rpc: rpcMock,
    })

    // Act
    const result = await submitApprovalAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      action: 'approved',
    })

    // Assert
    expect(result).toEqual({ ok: false, error: 'Unauthorized request.' })
  })

  it('should return error when approver employee profile is missing', async () => {
    // Arrange
    mocks.getEmployeeByEmail.mockResolvedValue(null)

    // Act
    const result = await submitApprovalAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      action: 'approved',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Approver employee profile not found.')
  })

  it('should return claim not found when claim lookup returns null', async () => {
    // Arrange
    mocks.getClaimWithOwner.mockResolvedValue(null)

    // Act
    const result = await submitApprovalAction({
      claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
      action: 'approved',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Claim not found.')
  })

  it('should process bulk approvals and report partial failures', async () => {
    // Arrange
    rpcMock
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'Claim already finalized.' } })

    // Act
    const result = await submitBulkApprovalAction({
      claimIds: [
        '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
        '8d9efea6-f7c2-4b26-b8f4-2f3f65b9f84d',
      ],
      action: 'approved',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.succeeded).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.error).toBe('1 claim(s) failed to update.')
    expect(result.errors[0]).toEqual({
      claimId: '8d9efea6-f7c2-4b26-b8f4-2f3f65b9f84d',
      message: 'Claim already finalized.',
    })
  })

  it('should block bulk actions for unauthorized users', async () => {
    // Arrange
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      rpc: rpcMock,
    })

    // Act
    const result = await submitBulkApprovalAction({
      claimIds: ['5db22d75-b209-4f30-b5c8-f4f27ebee9e8'],
      action: 'approved',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.failed).toBe(1)
    expect(result.errors[0]?.message).toBe('Unauthorized request.')
  })

  it('should block bulk actions when approver profile is missing', async () => {
    // Arrange
    mocks.getEmployeeByEmail.mockResolvedValue(null)

    // Act
    const result = await submitBulkApprovalAction({
      claimIds: [
        '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
        '8d9efea6-f7c2-4b26-b8f4-2f3f65b9f84d',
      ],
      action: 'approved',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.failed).toBe(2)
    expect(result.error).toBe('Approver employee profile not found.')
    expect(result.errors).toEqual([
      {
        claimId: '5db22d75-b209-4f30-b5c8-f4f27ebee9e8',
        message: 'Approver employee profile not found.',
      },
      {
        claimId: '8d9efea6-f7c2-4b26-b8f4-2f3f65b9f84d',
        message: 'Approver employee profile not found.',
      },
    ])
  })

  it('should pass normalized filters to pending approvals query', async () => {
    // Arrange
    const rawFilters = {
      employeeName: 'Yohan',
      claimDateFrom: '01/03/2026',
    }

    // Act
    await getPendingApprovalsAction(null, 10, rawFilters)

    // Assert
    expect(mocks.normalizeApprovalHistoryFilters).toHaveBeenCalledWith(
      rawFilters
    )
    expect(mocks.getPendingApprovalsPaginated).toHaveBeenCalledWith(
      expect.anything(),
      'approver@nxtwave.co.in',
      null,
      10,
      {
        employeeName: null,
        claimStatus: null,
        claimDateFrom: null,
        claimDateTo: null,
        amountOperator: 'lte',
        amountValue: null,
        locationType: null,
        claimDateSort: 'desc',
      }
    )
  })

  it('should pass new amount and location filters to pending approvals query', async () => {
    await getPendingApprovalsAction(null, 10, {
      amountOperator: 'gte',
      amountValue: '350',
      locationType: 'outstation',
      claimDateSort: 'asc',
    })

    expect(mocks.getPendingApprovalsPaginated).toHaveBeenCalledWith(
      expect.anything(),
      'approver@nxtwave.co.in',
      null,
      10,
      {
        employeeName: null,
        claimStatus: null,
        claimDateFrom: null,
        claimDateTo: null,
        amountOperator: 'lte',
        amountValue: null,
        locationType: null,
        claimDateSort: 'desc',
      }
    )
  })

  it('should throw for unauthorized pending approvals access', async () => {
    // Arrange
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    })

    // Act + Assert
    await expect(getPendingApprovalsAction(null, 10, {})).rejects.toThrow(
      'Unauthorized request.'
    )
  })

  it('should throw for unauthorized approval history access', async () => {
    // Arrange
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    })

    // Act + Assert
    await expect(getApprovalHistoryAction(null, 10, {})).rejects.toThrow(
      'Unauthorized request.'
    )
  })

  it('should pass normalized filters to approval history query', async () => {
    // Act
    await getApprovalHistoryAction('cursor-1', 20, {
      claimStatus: '7a0068ba-39c3-4229-b6f5-88559ace4e77',
      claimDateFrom: '2026-03-01',
      claimDateTo: '2026-03-03',
    })

    // Assert
    expect(mocks.getFilteredApprovalHistoryPaginated).toHaveBeenCalledWith(
      expect.anything(),
      'cursor-1',
      20,
      {
        employeeName: null,
        claimStatus: null,
        claimDateFrom: null,
        claimDateTo: null,
        amountOperator: 'lte',
        amountValue: null,
        locationType: null,
        claimDateSort: 'desc',
        hodApprovedFrom: null,
        hodApprovedTo: null,
        financeApprovedFrom: null,
        financeApprovedTo: null,
      }
    )
  })

  it('should fetch claim available actions for authorized users', async () => {
    // Act
    const result = await getClaimAvailableActionsAction(
      '5db22d75-b209-4f30-b5c8-f4f27ebee9e8'
    )

    // Assert
    expect(result).toHaveLength(2)
    expect(mocks.getClaimAvailableActions).toHaveBeenCalledWith(
      expect.anything(),
      '5db22d75-b209-4f30-b5c8-f4f27ebee9e8'
    )
  })

  it('should reject invalid bulk approval payloads', async () => {
    // Act
    const result = await submitBulkApprovalAction({
      claimIds: [],
      action: 'approved',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.failed).toBe(0)
    expect(result.succeeded).toBe(0)
    expect(result.errors).toEqual([])
    expect(result.error).toBeTruthy()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('should block claim available actions access for unauthorized users', async () => {
    // Arrange
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      rpc: rpcMock,
    })

    // Act + Assert
    await expect(
      getClaimAvailableActionsAction('5db22d75-b209-4f30-b5c8-f4f27ebee9e8')
    ).rejects.toThrow('Unauthorized request.')
  })
})
