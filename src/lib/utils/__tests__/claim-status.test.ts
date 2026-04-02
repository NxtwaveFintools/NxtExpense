import { describe, expect, it } from 'vitest'

import {
  getClaimStatusDisplay,
  getClaimStatusDisplayLabel,
} from '@/lib/utils/claim-status'

describe('claim status helpers', () => {
  it('returns provided status name for approved status code', () => {
    expect(getClaimStatusDisplayLabel('APPROVED', 'Finance Approved')).toBe(
      'Finance Approved'
    )
  })

  it('returns status name without remapping legacy labels', () => {
    expect(
      getClaimStatusDisplayLabel('L3_PENDING_FINANCE_REVIEW', 'Approved')
    ).toBe('Approved')
  })

  it('returns status name when non-empty', () => {
    expect(getClaimStatusDisplayLabel('L1_PENDING', 'L1 Pending')).toBe(
      'L1 Pending'
    )
  })

  it('falls back to status code when status name is blank', () => {
    expect(getClaimStatusDisplayLabel('REJECTED', '   ')).toBe('REJECTED')
  })

  it('returns empty string when both status code and name are missing', () => {
    expect(getClaimStatusDisplayLabel(null, undefined)).toBe('')
  })

  it('uses DB-provided allow-resubmit label and color when available', () => {
    const display = getClaimStatusDisplay({
      statusCode: 'REJECTED',
      statusName: 'Rejected',
      statusDisplayColor: 'red',
      allowResubmit: true,
      allowResubmitStatusName: 'Rejected - Reclaim Allowed',
      allowResubmitDisplayColor: 'orange',
    })

    expect(display).toEqual({
      label: 'Rejected - Reclaim Allowed',
      colorToken: 'orange',
    })
  })

  it('falls back to default status label/color when allow-resubmit overrides are absent', () => {
    const display = getClaimStatusDisplay({
      statusCode: 'REJECTED',
      statusName: 'Rejected',
      statusDisplayColor: 'red',
      allowResubmit: true,
      allowResubmitStatusName: null,
      allowResubmitDisplayColor: null,
    })

    expect(display).toEqual({
      label: 'Rejected',
      colorToken: 'red',
    })
  })

  it('returns default status label/color when allow-resubmit is false', () => {
    const display = getClaimStatusDisplay({
      statusCode: 'L1_PENDING',
      statusName: 'Submitted - Awaiting SBH Approval',
      statusDisplayColor: 'yellow',
      allowResubmit: false,
    })

    expect(display).toEqual({
      label: 'Submitted - Awaiting SBH Approval',
      colorToken: 'yellow',
    })
  })
})
