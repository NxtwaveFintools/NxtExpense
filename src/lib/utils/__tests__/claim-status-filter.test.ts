import { describe, expect, it } from 'vitest'

import {
  buildClaimStatusFilterOptions,
  buildClaimStatusFilterValue,
  isValidClaimStatusFilterValue,
  parseClaimStatusFilterValue,
} from '@/lib/utils/claim-status-filter'

const REJECTED_STATUS_ID = '3ae9b558-c006-427d-8ce6-13057d438d17'

describe('claim status filter value helpers', () => {
  it('builds default status filter value as raw UUID', () => {
    expect(buildClaimStatusFilterValue(REJECTED_STATUS_ID)).toBe(
      REJECTED_STATUS_ID
    )
  })

  it('builds allow-resubmit filter value using encoded suffix', () => {
    expect(buildClaimStatusFilterValue(REJECTED_STATUS_ID, true)).toBe(
      `${REJECTED_STATUS_ID}:allow_resubmit`
    )
  })

  it('parses plain UUID filter values', () => {
    expect(parseClaimStatusFilterValue(REJECTED_STATUS_ID)).toEqual({
      statusId: REJECTED_STATUS_ID,
      allowResubmitOnly: false,
    })
  })

  it('parses allow-resubmit encoded filter values', () => {
    expect(
      parseClaimStatusFilterValue(`${REJECTED_STATUS_ID}:allow_resubmit`)
    ).toEqual({
      statusId: REJECTED_STATUS_ID,
      allowResubmitOnly: true,
    })
  })

  it('rejects invalid filter values', () => {
    expect(parseClaimStatusFilterValue('invalid')).toBeNull()
    expect(parseClaimStatusFilterValue('')).toBeNull()
    expect(parseClaimStatusFilterValue(null)).toBeNull()
    expect(isValidClaimStatusFilterValue('invalid')).toBe(false)
  })
})

describe('buildClaimStatusFilterOptions', () => {
  it('builds DB-driven base and allow-resubmit options', () => {
    const options = buildClaimStatusFilterOptions([
      {
        id: REJECTED_STATUS_ID,
        status_code: 'REJECTED',
        status_name: 'Rejected',
        allow_resubmit_status_name: 'Rejected - Allow Reclaim',
      },
    ])

    expect(options).toEqual([
      {
        value: REJECTED_STATUS_ID,
        label: 'Rejected',
        statusId: REJECTED_STATUS_ID,
        allowResubmitOnly: false,
      },
      {
        value: `${REJECTED_STATUS_ID}:allow_resubmit`,
        label: 'Rejected - Allow Reclaim',
        statusId: REJECTED_STATUS_ID,
        allowResubmitOnly: true,
      },
    ])
  })
})
