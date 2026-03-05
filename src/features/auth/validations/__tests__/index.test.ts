import { describe, expect, it } from 'vitest'

import { emailPasswordLoginSchema } from '../index'

describe('emailPasswordLoginSchema', () => {
  describe('valid inputs', () => {
    it('accepts a valid corporate email with @nxtwave.co.in', () => {
      const result = emailPasswordLoginSchema.safeParse({
        email: 'sandeep@nxtwave.co.in',
        password: 'Password@123',
      })
      expect(result.success).toBe(true)
    })

    it('accepts a valid corporate email with @nxtwave.tech', () => {
      const result = emailPasswordLoginSchema.safeParse({
        email: 'ravi@nxtwave.tech',
        password: 'secure123',
      })
      expect(result.success).toBe(true)
    })

    it('accepts a valid corporate email with @nxtwave.in', () => {
      const result = emailPasswordLoginSchema.safeParse({
        email: 'prasad@nxtwave.in',
        password: 'secure123',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('invalid email — format', () => {
    it('rejects a non-email string', () => {
      const result = emailPasswordLoginSchema.safeParse({
        email: 'not-an-email',
        password: 'secure123',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('valid email')
      }
    })

    it('rejects empty email', () => {
      const result = emailPasswordLoginSchema.safeParse({
        email: '',
        password: 'secure123',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('invalid email — domain restriction', () => {
    it('rejects @gmail.com email', () => {
      const result = emailPasswordLoginSchema.safeParse({
        email: 'user@gmail.com',
        password: 'secure123',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('corporate')
      }
    })

    it('rejects @outlook.com email', () => {
      const result = emailPasswordLoginSchema.safeParse({
        email: 'user@outlook.com',
        password: 'secure123',
      })
      expect(result.success).toBe(false)
    })

    it('rejects an email that looks like a corporate domain but is not', () => {
      const result = emailPasswordLoginSchema.safeParse({
        email: 'user@notnxtwave.co.in',
        password: 'secure123',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('invalid password', () => {
    it('rejects a password shorter than 6 characters', () => {
      const result = emailPasswordLoginSchema.safeParse({
        email: 'user@nxtwave.co.in',
        password: '123',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('6 characters')
      }
    })

    it('rejects empty password', () => {
      const result = emailPasswordLoginSchema.safeParse({
        email: 'user@nxtwave.co.in',
        password: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('missing fields', () => {
    it('rejects when email is missing', () => {
      const result = emailPasswordLoginSchema.safeParse({
        password: 'secure123',
      })
      expect(result.success).toBe(false)
    })

    it('rejects when password is missing', () => {
      const result = emailPasswordLoginSchema.safeParse({
        email: 'user@nxtwave.co.in',
      })
      expect(result.success).toBe(false)
    })
  })
})
