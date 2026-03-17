import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  getClaimWithOwner: vi.fn(),
  isFinanceTeamMember: vi.fn(),
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
}))

vi.mock('@/features/finance/permissions', () => ({
  isFinanceTeamMember: mocks.isFinanceTeamMember,
}))

import { submitApprovalAction } from '@/features/approvals/actions'
import { submitFinanceAction } from '@/features/finance/actions'
import { getClaimStatusDisplayLabel } from '@/lib/utils/claim-status'

import {
  applyApprovalTransition,
  applyFinanceTransition,
  createInitialWorkflowClaim,
  FINANCE_APPROVER_EMAILS,
  getWorkflowConfig,
  MANSOOR_EMAIL,
  resubmitRejectedClaim,
  type WorkflowClaimState,
} from '@/features/claims/workflow/__tests__/workflow-test-kit'

type ApprovalRpcParams = {
  p_claim_id: string
  p_action: 'approved' | 'rejected'
  p_notes: string | null
  p_allow_resubmit: boolean
}

type FinanceRpcParams = {
  p_claim_id: string
  p_action: 'issued' | 'finance_rejected'
  p_notes: string | null
  p_allow_resubmit: boolean
}

let activeUserEmail = ''
let claimSequence = 1
let claimStore = new Map<string, WorkflowClaimState>()

function nextClaimId(): string {
  const suffix = claimSequence.toString(16).padStart(12, '0')
  claimSequence += 1
  return `00000000-0000-4000-8000-${suffix}`
}

function setActor(email: string): void {
  activeUserEmail = email.trim().toLowerCase()
}

function addClaim(submitterEmail: string): WorkflowClaimState {
  const claim = createInitialWorkflowClaim(nextClaimId(), submitterEmail)
  claimStore.set(claim.id, claim)
  return claim
}

async function approveClaim(claimId: string, approverEmail: string) {
  setActor(approverEmail)
  return submitApprovalAction({
    claimId,
    action: 'approved',
    notes: 'Approved for next stage.',
  })
}

async function rejectClaim(
  claimId: string,
  approverEmail: string,
  notes: string,
  allowResubmit = true
) {
  setActor(approverEmail)
  return submitApprovalAction({
    claimId,
    action: 'rejected',
    notes,
    allowResubmit,
  })
}

async function financeApproveClaim(claimId: string, financeEmail: string) {
  setActor(financeEmail)
  return submitFinanceAction({
    claimId,
    action: 'issued',
    notes: 'Finance approved and queued for payout.',
  })
}

async function runStandardFlowScenario(
  submitterEmail: string,
  sbhEmail: string,
  financeEmail: string
) {
  const claim = addClaim(submitterEmail)

  expect(claim.statusCode).toBe('L1_PENDING')
  expect(claim.currentApprovalLevel).toBe(1)

  const level1Result = await approveClaim(claim.id, sbhEmail)
  expect(level1Result).toEqual({ ok: true, error: null })
  expect(claim.statusCode).toBe('L3_PENDING_FINANCE_REVIEW')
  expect(claim.currentApprovalLevel).toBe(3)

  const level3Result = await approveClaim(claim.id, MANSOOR_EMAIL)
  expect(level3Result).toEqual({ ok: true, error: null })
  expect(claim.currentApprovalLevel).toBeNull()

  const financeResult = await financeApproveClaim(claim.id, financeEmail)
  expect(financeResult).toEqual({ ok: true, error: null })

  expect(claim.statusCode).toBe('APPROVED')
  expect(getClaimStatusDisplayLabel(claim.statusCode, 'Approved')).toBe(
    'Finance Approved'
  )
  expect(claim.approvalHistory.map((entry) => entry.actorEmail)).toEqual([
    sbhEmail.toLowerCase(),
    MANSOOR_EMAIL,
    financeEmail.toLowerCase(),
  ])
  expect(claim.approvalHistory.map((entry) => entry.approvalLevel)).toEqual([
    1,
    3,
    null,
  ])

  return claim
}

describe('expense approval workflow integration — standard flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    activeUserEmail = 'finance1@nxtwave.co.in'
    claimSequence = 1
    claimStore = new Map<string, WorkflowClaimState>()

    mocks.createSupabaseServerClient.mockImplementation(async () => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: activeUserEmail ? { email: activeUserEmail } : null,
          },
        }),
      },
      rpc: vi.fn(async (rpcName: string, params: unknown) => {
        if (rpcName === 'submit_approval_action_atomic') {
          const typed = params as ApprovalRpcParams
          const claim = claimStore.get(typed.p_claim_id)
          if (!claim) {
            return { error: { message: 'Claim not found.' } }
          }

          const message = applyApprovalTransition(claim, activeUserEmail, typed)
          return { error: message ? { message } : null }
        }

        if (rpcName === 'submit_finance_action_atomic') {
          const typed = params as FinanceRpcParams
          const claim = claimStore.get(typed.p_claim_id)
          if (!claim) {
            return { error: { message: 'Claim not found.' } }
          }

          const message = applyFinanceTransition(claim, activeUserEmail, typed)
          return { error: message ? { message } : null }
        }

        return { error: { message: `Unexpected RPC: ${rpcName}` } }
      }),
    }))

    mocks.getEmployeeByEmail.mockImplementation(
      async (_s: unknown, email: string) => {
        if (!email) {
          return null
        }

        return {
          id: `emp-${email.toLowerCase()}`,
          employee_email: email.toLowerCase(),
        }
      }
    )

    mocks.getClaimWithOwner.mockImplementation(
      async (_s: unknown, claimId: string) => {
        const claim = claimStore.get(claimId)
        if (!claim) {
          return null
        }

        return {
          claim: { id: claim.id } as never,
          owner: { id: `emp-${claim.submitterEmail}` } as never,
        }
      }
    )

    mocks.isFinanceTeamMember.mockImplementation(
      async (_s: unknown, employee: { employee_email?: string }) =>
        FINANCE_APPROVER_EMAILS.has(
          (employee.employee_email ?? '').toLowerCase()
        )
    )
  })

  it('completes SRO(AP): Yohan -> Nagaraju -> Mansoor -> Finance', async () => {
    await runStandardFlowScenario(
      'yohan.mutluri@nxtwave.co.in',
      'nagaraju.madugula@nxtwave.co.in',
      'finance1@nxtwave.co.in'
    )
  })

  it('routes SRO(Kerala) through correct SBH mapping', async () => {
    const config = getWorkflowConfig('akshay.e@nxtwave.co.in')
    expect(config.coveredStates).toContain('Kerala')
    expect(config.level1ApproverEmail).toBe(
      'sreejish.mohanakumar@nxtwave.co.in'
    )

    await runStandardFlowScenario(
      'akshay.e@nxtwave.co.in',
      'sreejish.mohanakumar@nxtwave.co.in',
      'finance1@nxtwave.co.in'
    )
  })

  it('handles BOA(Karnataka) with Vignesh as SBH approver', async () => {
    await runStandardFlowScenario(
      'bhargavraj.gv@nxtwave.co.in',
      'vignesh.shenoy@nxtwave.co.in',
      'finance2@nxtwave.co.in'
    )
  })

  it('handles ABH(Tamil Nadu) through SBH then Mansoor then Finance', async () => {
    await runStandardFlowScenario(
      'hari.haran@nxtwave.co.in',
      'sreejish.mohanakumar@nxtwave.co.in',
      'finance2@nxtwave.co.in'
    )
  })

  it('EDGE-003 skips L2 routing and moves L1 directly to level 3 approver', async () => {
    const claim = addClaim('yohan.mutluri@nxtwave.co.in')

    const result = await approveClaim(
      claim.id,
      'nagaraju.madugula@nxtwave.co.in'
    )
    expect(result).toEqual({ ok: true, error: null })
    expect(claim.currentApprovalLevel).toBe(3)
    expect(claim.statusCode).toBe('L3_PENDING_FINANCE_REVIEW')
  })

  it('EDGE-012 blocks wrong approval level approver', async () => {
    const claim = addClaim('yohan.mutluri@nxtwave.co.in')

    const result = await approveClaim(claim.id, MANSOOR_EMAIL)
    expect(result).toEqual({
      ok: false,
      error: 'Claim is not at your approval level.',
    })
    expect(claim.approvalHistory).toHaveLength(0)
    expect(claim.statusCode).toBe('L1_PENDING')
  })

  it('EDGE-013 blocks self approval attempt', async () => {
    const claim = addClaim('yohan.mutluri@nxtwave.co.in')

    const result = await approveClaim(claim.id, 'yohan.mutluri@nxtwave.co.in')
    expect(result).toEqual({
      ok: false,
      error: 'Claim owner cannot approve their own claim.',
    })
    expect(claim.approvalHistory).toHaveLength(0)
  })

  it('supports SRO -> SBH -> rejected flow with reason and resubmission', async () => {
    const claim = addClaim('yohan.mutluri@nxtwave.co.in')

    const rejectResult = await rejectClaim(
      claim.id,
      'nagaraju.madugula@nxtwave.co.in',
      'Rejected by SBH: travel proof missing.',
      true
    )

    expect(rejectResult).toEqual({ ok: true, error: null })
    expect(claim.statusCode).toBe('REJECTED')
    expect(claim.rejectionReason).toBe('Rejected by SBH: travel proof missing.')
    expect(claim.allowResubmit).toBe(true)
    expect(claim.approvalHistory.at(-1)?.actorEmail).toBe(
      'nagaraju.madugula@nxtwave.co.in'
    )

    const blockedAfterRejection = await approveClaim(claim.id, MANSOOR_EMAIL)
    expect(blockedAfterRejection).toEqual({
      ok: false,
      error: 'Claim is already finalized.',
    })

    const replacement = resubmitRejectedClaim(claim, nextClaimId())
    claimStore.set(replacement.id, replacement)

    expect(claim.isSuperseded).toBe(true)
    expect(replacement.statusCode).toBe('L1_PENDING')
    expect(replacement.currentApprovalLevel).toBe(1)
  })
})
