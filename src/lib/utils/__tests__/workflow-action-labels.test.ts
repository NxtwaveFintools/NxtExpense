import { describe, expect, it } from 'vitest'

import {
  getWorkflowActionAllowReclaimLabel,
  getWorkflowActionCtaLabel,
} from '@/lib/utils/workflow-action-labels'

describe('workflow action CTA labels', () => {
  it('uses imperative labels for known workflow actions', () => {
    expect(
      getWorkflowActionCtaLabel({
        action: 'approved',
        display_label: 'Approved',
      })
    ).toBe('Approve')
    expect(
      getWorkflowActionCtaLabel({
        action: 'rejected',
        display_label: 'Rejected',
      })
    ).toBe('Reject')
    expect(
      getWorkflowActionCtaLabel({
        action: 'finance_rejected',
        display_label: 'Finance Rejected',
      })
    ).toBe('Reject')
    expect(
      getWorkflowActionCtaLabel({ action: 'issued', display_label: 'Issued' })
    ).toBe('Issue')
  })

  it('falls back to normalized display label for unknown actions', () => {
    expect(
      getWorkflowActionCtaLabel({
        action: 'escalated_for_review',
        display_label: ' Escalated   For Review ',
      })
    ).toBe('Escalated For Review')
  })

  it('falls back to title-cased action code when display label is blank', () => {
    expect(
      getWorkflowActionCtaLabel({
        action: 'send_back_to_l1',
        display_label: ' ',
      })
    ).toBe('Send Back To L1')
  })

  it('formats allow reclaim labels with ampersand', () => {
    expect(
      getWorkflowActionAllowReclaimLabel({
        action: 'rejected',
        display_label: 'Rejected',
      })
    ).toBe('Reject & Allow Reclaim')
  })
})
