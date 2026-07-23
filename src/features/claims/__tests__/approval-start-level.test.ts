import { describe, expect, it } from 'vitest'

import { EMPLOYEE_COLUMNS_FOR_TEST } from '@/lib/services/employee-service'
import {
  resolveStartLevel,
  shouldBlockForMissingLevel1Approver,
} from '@/features/claims/server/services/submit-claim.orchestrator'

describe('EMPLOYEE_COLUMNS', () => {
  it('selects approval_start_level so the override is never silently undefined', () => {
    expect(EMPLOYEE_COLUMNS_FOR_TEST).toContain('approval_start_level')
  })
})

describe('resolveStartLevel', () => {
  it('uses the employee override when set', () => {
    expect(resolveStartLevel(2, [1, 2, 3])).toBe(2)
  })

  it('falls back to the designation flow when the override is null', () => {
    expect(resolveStartLevel(null, [1, 2, 3])).toBe(1)
  })

  it('falls back to the designation flow when the override is undefined', () => {
    expect(resolveStartLevel(undefined, [2, 3])).toBe(2)
  })

  it('returns undefined when neither source provides a level', () => {
    expect(resolveStartLevel(null, [])).toBeUndefined()
  })
})

describe('shouldBlockForMissingLevel1Approver', () => {
  it('blocks when starting at stage 1 with no level 1 approver', () => {
    expect(shouldBlockForMissingLevel1Approver(1, null)).toBe(true)
  })

  it('allows when starting at stage 1 with a level 1 approver', () => {
    expect(shouldBlockForMissingLevel1Approver(1, 'emp-sbh')).toBe(false)
  })

  it('allows an overridden stage 2 start with no level 1 approver', () => {
    // This is Chandramouli. If this ever returns true he is silently re-broken.
    expect(shouldBlockForMissingLevel1Approver(2, null)).toBe(false)
  })

  it('allows stage 2 with a level 1 approver present', () => {
    expect(shouldBlockForMissingLevel1Approver(2, 'emp-sbh')).toBe(false)
  })

  it('does not block when no start level could be resolved', () => {
    expect(shouldBlockForMissingLevel1Approver(undefined, null)).toBe(false)
  })
})
