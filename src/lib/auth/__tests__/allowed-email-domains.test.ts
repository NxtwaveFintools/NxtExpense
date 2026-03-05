import { describe, expect, it } from 'vitest'

import {
  getAllowedCorporateEmailHint,
  isAllowedCorporateEmail,
} from '../allowed-email-domains'

describe('isAllowedCorporateEmail', () => {
  describe('allowed domains', () => {
    it('accepts @nxtwave.co.in emails', () => {
      expect(isAllowedCorporateEmail('user@nxtwave.co.in')).toBe(true)
    })

    it('accepts @nxtwave.tech emails', () => {
      expect(isAllowedCorporateEmail('user@nxtwave.tech')).toBe(true)
    })

    it('accepts @nxtwave.in emails', () => {
      expect(isAllowedCorporateEmail('user@nxtwave.in')).toBe(true)
    })

    it('normalizes email to lowercase before checking', () => {
      expect(isAllowedCorporateEmail('USER@NXTWAVE.CO.IN')).toBe(true)
      expect(isAllowedCorporateEmail('User@NxtWave.Tech')).toBe(true)
    })

    it('accepts emails with leading/trailing whitespace', () => {
      expect(isAllowedCorporateEmail('  user@nxtwave.co.in  ')).toBe(true)
    })
  })

  describe('rejected domains', () => {
    it('rejects gmail.com', () => {
      expect(isAllowedCorporateEmail('user@gmail.com')).toBe(false)
    })

    it('rejects outlook.com', () => {
      expect(isAllowedCorporateEmail('user@outlook.com')).toBe(false)
    })

    it('rejects subdomains of allowed domains', () => {
      expect(isAllowedCorporateEmail('user@mail.nxtwave.co.in')).toBe(false)
    })

    it('rejects domains that contain the allowed domain as a substring', () => {
      expect(isAllowedCorporateEmail('user@mynxtwave.co.in')).toBe(false)
    })

    it('rejects emails without @ sign', () => {
      expect(isAllowedCorporateEmail('usernxtwave.co.in')).toBe(false)
    })

    it('rejects emails where @ is the last character', () => {
      expect(isAllowedCorporateEmail('user@')).toBe(false)
    })
  })

  describe('null / undefined / empty input', () => {
    it('returns false for null', () => {
      expect(isAllowedCorporateEmail(null)).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(isAllowedCorporateEmail(undefined)).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(isAllowedCorporateEmail('')).toBe(false)
    })
  })
})

describe('getAllowedCorporateEmailHint', () => {
  it('includes all three allowed domain hints', () => {
    const hint = getAllowedCorporateEmailHint()
    expect(hint).toContain('@nxtwave.co.in')
    expect(hint).toContain('@nxtwave.tech')
    expect(hint).toContain('@nxtwave.in')
  })
})
