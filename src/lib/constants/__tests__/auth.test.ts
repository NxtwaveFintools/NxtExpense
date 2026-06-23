import { describe, expect, it } from 'vitest'

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../auth'

describe('auth password policy', () => {
  it('requires at least 6 characters', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(6)
  })

  it('caps password length at the bcrypt 72-byte limit', () => {
    expect(MAX_PASSWORD_LENGTH).toBe(72)
  })

  it('keeps the minimum below the maximum', () => {
    expect(MIN_PASSWORD_LENGTH).toBeLessThan(MAX_PASSWORD_LENGTH)
  })
})
