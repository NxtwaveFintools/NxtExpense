import { describe, expect, it } from 'vitest'

import {
  adminReassignApproverSchema,
  adminRollbackSchema,
  adminToggleActiveSchema,
  adminUpdateRateSchema,
  adminUpdateVehicleRatesSchema,
} from '@/features/admin/validations'

const VALID_UUID = '5db22d75-b209-4f30-b5c8-f4f27ebee9e8'

describe('adminRollbackSchema', () => {
  it('accepts valid rollback payload', () => {
    const result = adminRollbackSchema.safeParse({
      claimId: VALID_UUID,
      reason: 'Rollback requested after incorrect finance action',
      confirmation: 'CONFIRM',
    })

    expect(result.success).toBe(true)
  })

  it('rejects rollback without reason', () => {
    const result = adminRollbackSchema.safeParse({
      claimId: VALID_UUID,
      reason: '   ',
      confirmation: 'CONFIRM',
    })

    expect(result.success).toBe(false)
  })
})

describe('adminReassignApproverSchema', () => {
  it('accepts valid reassignment payload with optional approvers omitted', () => {
    const result = adminReassignApproverSchema.safeParse({
      employeeId: VALID_UUID,
      reason: 'Approver change due to org restructure',
      confirmation: 'CONFIRM',
    })

    expect(result.success).toBe(true)
  })

  it('rejects invalid approver email', () => {
    const result = adminReassignApproverSchema.safeParse({
      employeeId: VALID_UUID,
      approvalLevel1: 'not-an-email',
      reason: 'Valid reason',
      confirmation: 'CONFIRM',
    })

    expect(result.success).toBe(false)
  })

  it('accepts reassignment reason longer than 500 chars at schema level (enforced in actions)', () => {
    const result = adminReassignApproverSchema.safeParse({
      employeeId: VALID_UUID,
      reason: 'x'.repeat(501),
      confirmation: 'CONFIRM',
    })

    expect(result.success).toBe(true)
  })
})

describe('adminToggleActiveSchema', () => {
  it('accepts valid toggle payload', () => {
    const result = adminToggleActiveSchema.safeParse({
      id: VALID_UUID,
      isActive: true,
    })

    expect(result.success).toBe(true)
  })

  it('rejects invalid toggle identifier', () => {
    const result = adminToggleActiveSchema.safeParse({
      id: 'invalid-id',
      isActive: false,
    })

    expect(result.success).toBe(false)
  })
})

describe('admin rate update schemas', () => {
  it('accepts non-negative simple rate update', () => {
    const result = adminUpdateRateSchema.safeParse({
      id: VALID_UUID,
      rateAmount: 0,
    })

    expect(result.success).toBe(true)
  })

  it('rejects negative simple rate update', () => {
    const result = adminUpdateRateSchema.safeParse({
      id: VALID_UUID,
      rateAmount: -1,
    })

    expect(result.success).toBe(false)
  })

  it('accepts vehicle rate update payload with integer KM limit', () => {
    const result = adminUpdateVehicleRatesSchema.safeParse({
      id: VALID_UUID,
      baseFuelRatePerDay: 300,
      intercityRatePerKm: 8,
      maxKmRoundTrip: 300,
    })

    expect(result.success).toBe(true)
  })

  it('rejects non-integer KM limit in vehicle rate update', () => {
    const result = adminUpdateVehicleRatesSchema.safeParse({
      id: VALID_UUID,
      baseFuelRatePerDay: 300,
      intercityRatePerKm: 8,
      maxKmRoundTrip: 300.5,
    })

    expect(result.success).toBe(false)
  })
})
