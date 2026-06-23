import { describe, expect, it } from 'vitest'

import {
  APPROVAL_LEVELS,
  INTERMEDIATE_APPROVAL_LEVELS,
  MAX_APPROVAL_LEVEL,
  MIN_APPROVAL_LEVEL,
  isFinalApprovalLevel,
  isIntermediateApprovalLevel,
} from '../approval-levels'

describe('approval-levels', () => {
  it('models the fixed three-level approval chain', () => {
    expect(APPROVAL_LEVELS).toEqual([1, 2, 3])
    expect(MIN_APPROVAL_LEVEL).toBe(1)
    expect(MAX_APPROVAL_LEVEL).toBe(3)
  })

  it('treats the highest level as the final (finance-facing) level', () => {
    expect(MAX_APPROVAL_LEVEL).toBe(APPROVAL_LEVELS[APPROVAL_LEVELS.length - 1])
    expect(isFinalApprovalLevel(MAX_APPROVAL_LEVEL)).toBe(true)
  })

  it('derives intermediate levels as every non-final level', () => {
    expect(INTERMEDIATE_APPROVAL_LEVELS).toEqual([1, 2])
    expect(INTERMEDIATE_APPROVAL_LEVELS).not.toContain(MAX_APPROVAL_LEVEL)
  })

  describe('isFinalApprovalLevel', () => {
    it('is true only for the final level', () => {
      expect(isFinalApprovalLevel(3)).toBe(true)
      expect(isFinalApprovalLevel(1)).toBe(false)
      expect(isFinalApprovalLevel(2)).toBe(false)
    })

    it('is false for null or undefined', () => {
      expect(isFinalApprovalLevel(null)).toBe(false)
      expect(isFinalApprovalLevel(undefined)).toBe(false)
    })
  })

  describe('isIntermediateApprovalLevel', () => {
    it('is true for non-final levels', () => {
      expect(isIntermediateApprovalLevel(1)).toBe(true)
      expect(isIntermediateApprovalLevel(2)).toBe(true)
    })

    it('is false for the final level and for null/undefined', () => {
      expect(isIntermediateApprovalLevel(3)).toBe(false)
      expect(isIntermediateApprovalLevel(null)).toBe(false)
      expect(isIntermediateApprovalLevel(undefined)).toBe(false)
    })
  })
})
