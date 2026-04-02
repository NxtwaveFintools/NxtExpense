export type WorkflowStatus =
  | 'L1_PENDING'
  | 'L3_PENDING_FINANCE_REVIEW'
  | 'REJECTED'
  | 'APPROVED'
  | 'PAYMENT_RELEASED'

type ApprovalAction = 'approved' | 'rejected'
type FinanceAction =
  | 'finance_approved'
  | 'payment_released'
  | 'released'
  | 'finance_rejected'

export type WorkflowHistoryEntry = {
  actorEmail: string
  action: ApprovalAction | FinanceAction
  approvalLevel: 1 | 3 | null
  notes: string | null
  allowResubmit: boolean
}

export type WorkflowClaimState = {
  id: string
  submitterEmail: string
  statusCode: WorkflowStatus
  currentApprovalLevel: 1 | 3 | null
  approvalHistory: WorkflowHistoryEntry[]
  allowResubmit: boolean
  rejectionReason: string | null
  isSuperseded: boolean
}

type WorkflowConfig = {
  submitterEmail: string
  level1ApproverEmail: string | null
  level3ApproverEmail: string | null
  coveredStates: string[]
}

type ApprovalRpcParams = {
  p_claim_id: string
  p_action: ApprovalAction
  p_notes: string | null
  p_allow_resubmit: boolean
}

type FinanceRpcParams = {
  p_claim_id: string
  p_action: FinanceAction
  p_notes: string | null
  p_allow_resubmit: boolean
}

export const MANSOOR_EMAIL = 'mansoor@nxtwave.co.in'

export const FINANCE_APPROVER_EMAILS = new Set([
  'finance1@nxtwave.co.in',
  'finance2@nxtwave.co.in',
])

const WORKFLOW_CONFIG_BY_SUBMITTER: Record<string, WorkflowConfig> = {
  'yohan.mutluri@nxtwave.co.in': {
    submitterEmail: 'yohan.mutluri@nxtwave.co.in',
    level1ApproverEmail: 'nagaraju.madugula@nxtwave.co.in',
    level3ApproverEmail: MANSOOR_EMAIL,
    coveredStates: ['Andhra Pradesh'],
  },
  'akshay.e@nxtwave.co.in': {
    submitterEmail: 'akshay.e@nxtwave.co.in',
    level1ApproverEmail: 'sreejish.mohanakumar@nxtwave.co.in',
    level3ApproverEmail: MANSOOR_EMAIL,
    coveredStates: ['Kerala'],
  },
  'bhargavraj.gv@nxtwave.co.in': {
    submitterEmail: 'bhargavraj.gv@nxtwave.co.in',
    level1ApproverEmail: 'vignesh.shenoy@nxtwave.co.in',
    level3ApproverEmail: MANSOOR_EMAIL,
    coveredStates: ['Karnataka'],
  },
  'hari.haran@nxtwave.co.in': {
    submitterEmail: 'hari.haran@nxtwave.co.in',
    level1ApproverEmail: 'sreejish.mohanakumar@nxtwave.co.in',
    level3ApproverEmail: MANSOOR_EMAIL,
    coveredStates: ['Tamil Nadu'],
  },
  'nagaraju.madugula@nxtwave.co.in': {
    submitterEmail: 'nagaraju.madugula@nxtwave.co.in',
    level1ApproverEmail: null,
    level3ApproverEmail: MANSOOR_EMAIL,
    coveredStates: ['Andhra Pradesh'],
  },
  'vignesh.shenoy@nxtwave.co.in': {
    submitterEmail: 'vignesh.shenoy@nxtwave.co.in',
    level1ApproverEmail: null,
    level3ApproverEmail: MANSOOR_EMAIL,
    coveredStates: ['Karnataka'],
  },
  'satyapriya.dash@nxtwave.co.in': {
    submitterEmail: 'satyapriya.dash@nxtwave.co.in',
    level1ApproverEmail: null,
    level3ApproverEmail: MANSOOR_EMAIL,
    coveredStates: [
      'Delhi NCR',
      'West Bengal',
      'Odisha',
      'Rajasthan',
      'Uttar Pradesh',
    ],
  },
  'mansoor@nxtwave.co.in': {
    submitterEmail: 'mansoor@nxtwave.co.in',
    level1ApproverEmail: null,
    level3ApproverEmail: null,
    coveredStates: ['All States'],
  },
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function getWorkflowConfig(submitterEmail: string): WorkflowConfig {
  const key = normalizeEmail(submitterEmail)
  const config = WORKFLOW_CONFIG_BY_SUBMITTER[key]
  if (!config) {
    throw new Error(`Missing workflow config for ${submitterEmail}`)
  }

  return config
}

export function createInitialWorkflowClaim(
  claimId: string,
  submitterEmail: string
): WorkflowClaimState {
  const config = getWorkflowConfig(submitterEmail)

  const startsAtLevel1 = Boolean(config.level1ApproverEmail)
  const startsAtLevel3 = !startsAtLevel1 && Boolean(config.level3ApproverEmail)

  return {
    id: claimId,
    submitterEmail: normalizeEmail(submitterEmail),
    statusCode: startsAtLevel1 ? 'L1_PENDING' : 'L3_PENDING_FINANCE_REVIEW',
    currentApprovalLevel: startsAtLevel1 ? 1 : startsAtLevel3 ? 3 : null,
    approvalHistory: [],
    allowResubmit: false,
    rejectionReason: null,
    isSuperseded: false,
  }
}

function getExpectedApproverForCurrentLevel(
  claim: WorkflowClaimState
): string | null {
  const config = getWorkflowConfig(claim.submitterEmail)

  if (claim.currentApprovalLevel === 1) {
    return config.level1ApproverEmail
  }

  if (claim.currentApprovalLevel === 3) {
    return config.level3ApproverEmail
  }

  return null
}

export function applyApprovalTransition(
  claim: WorkflowClaimState,
  actorEmail: string,
  params: ApprovalRpcParams
): string | null {
  const normalizedActor = normalizeEmail(actorEmail)

  if (
    claim.statusCode === 'APPROVED' ||
    claim.statusCode === 'PAYMENT_RELEASED' ||
    claim.statusCode === 'REJECTED'
  ) {
    return 'Claim is already finalized.'
  }

  if (normalizedActor === claim.submitterEmail) {
    return 'Claim owner cannot approve their own claim.'
  }

  const expectedApprover = getExpectedApproverForCurrentLevel(claim)
  if (
    !expectedApprover ||
    normalizeEmail(expectedApprover) !== normalizedActor
  ) {
    return 'Claim is not at your approval level.'
  }

  claim.approvalHistory.push({
    actorEmail: normalizedActor,
    action: params.p_action,
    approvalLevel: claim.currentApprovalLevel,
    notes: params.p_notes,
    allowResubmit: params.p_allow_resubmit,
  })

  if (params.p_action === 'rejected') {
    claim.statusCode = 'REJECTED'
    claim.currentApprovalLevel = null
    claim.allowResubmit = params.p_allow_resubmit
    claim.rejectionReason = params.p_notes
    return null
  }

  if (claim.currentApprovalLevel === 1) {
    claim.statusCode = 'L3_PENDING_FINANCE_REVIEW'
    claim.currentApprovalLevel = 3
    return null
  }

  claim.statusCode = 'L3_PENDING_FINANCE_REVIEW'
  claim.currentApprovalLevel = null
  return null
}

export function applyFinanceTransition(
  claim: WorkflowClaimState,
  actorEmail: string,
  params: FinanceRpcParams
): string | null {
  const normalizedActor = normalizeEmail(actorEmail)

  if (!FINANCE_APPROVER_EMAILS.has(normalizedActor)) {
    return 'Finance access is required.'
  }

  if (
    claim.statusCode === 'PAYMENT_RELEASED' ||
    claim.statusCode === 'REJECTED'
  ) {
    return 'Claim is already finalized.'
  }

  const isFinanceApprovalAction = params.p_action === 'finance_approved'
  const isPaymentReleaseAction =
    params.p_action === 'payment_released' || params.p_action === 'released'

  if (params.p_action === 'finance_rejected') {
    if (
      claim.statusCode !== 'L3_PENDING_FINANCE_REVIEW' ||
      claim.currentApprovalLevel !== null
    ) {
      return 'Claim is not in finance review stage.'
    }
  } else if (isFinanceApprovalAction) {
    if (
      claim.statusCode !== 'L3_PENDING_FINANCE_REVIEW' ||
      claim.currentApprovalLevel !== null
    ) {
      return 'Claim is not in finance review stage.'
    }
  } else if (isPaymentReleaseAction) {
    if (claim.statusCode !== 'APPROVED') {
      return 'Claim is not finance approved yet.'
    }
  }

  claim.approvalHistory.push({
    actorEmail: normalizedActor,
    action: params.p_action,
    approvalLevel: null,
    notes: params.p_notes,
    allowResubmit: params.p_allow_resubmit,
  })

  if (params.p_action === 'finance_rejected') {
    claim.statusCode = 'REJECTED'
    claim.allowResubmit = params.p_allow_resubmit
    claim.rejectionReason = params.p_notes
    return null
  }

  if (isFinanceApprovalAction) {
    claim.statusCode = 'APPROVED'
    claim.allowResubmit = false
    claim.rejectionReason = null
    return null
  }

  if (isPaymentReleaseAction) {
    claim.statusCode = 'PAYMENT_RELEASED'
    claim.allowResubmit = false
    claim.rejectionReason = null
    return null
  }

  return null
}

export function resubmitRejectedClaim(
  rejectedClaim: WorkflowClaimState,
  replacementClaimId: string
): WorkflowClaimState {
  if (rejectedClaim.statusCode !== 'REJECTED' || !rejectedClaim.allowResubmit) {
    throw new Error('Claim is not eligible for resubmission.')
  }

  rejectedClaim.isSuperseded = true
  return createInitialWorkflowClaim(
    replacementClaimId,
    rejectedClaim.submitterEmail
  )
}
