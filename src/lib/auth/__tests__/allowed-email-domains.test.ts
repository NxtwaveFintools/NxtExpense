import { describe, expect, it } from 'vitest'

import {
  appendAllowedDomainHint,
  isDomainAllowed,
} from '../allowed-email-domains'

const TEST_DOMAINS = ['nxtwave.co.in', 'nxtwave.tech', 'nxtwave.in']

describe('isDomainAllowed', () => {
  describe('allowed domains', () => {
    it('accepts @nxtwave.co.in emails', () => {
      expect(isDomainAllowed(TEST_DOMAINS, 'user@nxtwave.co.in')).toBe(true)
    })

    it('accepts @nxtwave.tech emails', () => {
      expect(isDomainAllowed(TEST_DOMAINS, 'user@nxtwave.tech')).toBe(true)
    })

    it('accepts @nxtwave.in emails', () => {
      expect(isDomainAllowed(TEST_DOMAINS, 'user@nxtwave.in')).toBe(true)
    })

    it('normalizes email to lowercase before checking', () => {
      expect(isDomainAllowed(TEST_DOMAINS, 'USER@NXTWAVE.CO.IN')).toBe(true)
      expect(isDomainAllowed(TEST_DOMAINS, 'User@NxtWave.Tech')).toBe(true)
    })

    it('accepts emails with leading/trailing whitespace', () => {
      expect(isDomainAllowed(TEST_DOMAINS, '  user@nxtwave.co.in  ')).toBe(true)
    })
  })

  describe('rejected domains', () => {
    it('rejects gmail.com', () => {
      expect(isDomainAllowed(TEST_DOMAINS, 'user@gmail.com')).toBe(false)
    })

    it('rejects outlook.com', () => {
      expect(isDomainAllowed(TEST_DOMAINS, 'user@outlook.com')).toBe(false)
    })

    it('rejects subdomains of allowed domains', () => {
      expect(isDomainAllowed(TEST_DOMAINS, 'user@mail.nxtwave.co.in')).toBe(
        false
      )
    })

    it('rejects domains that contain the allowed domain as a substring', () => {
      expect(isDomainAllowed(TEST_DOMAINS, 'user@mynxtwave.co.in')).toBe(false)
    })

    it('rejects emails without @ sign', () => {
      expect(isDomainAllowed(TEST_DOMAINS, 'usernxtwave.co.in')).toBe(false)
    })

    it('rejects emails where @ is the last character', () => {
      expect(isDomainAllowed(TEST_DOMAINS, 'user@')).toBe(false)
    })
  })

  describe('null / undefined / empty input', () => {
    it('returns false for null', () => {
      expect(isDomainAllowed(TEST_DOMAINS, null)).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(isDomainAllowed(TEST_DOMAINS, undefined)).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(isDomainAllowed(TEST_DOMAINS, '')).toBe(false)
    })
  })

  describe('domain list behavior', () => {
    it('returns false when domain list is empty', () => {
      expect(isDomainAllowed([], 'user@nxtwave.co.in')).toBe(false)
    })

    it('accepts a domain added dynamically to the list', () => {
      expect(
        isDomainAllowed([...TEST_DOMAINS, 'custom.org'], 'user@custom.org')
      ).toBe(true)
    })
  })
})

describe('appendAllowedDomainHint', () => {
  it('appends a hint when a domain list is available', () => {
    expect(
      appendAllowedDomainHint(
        'Only corporate emails are allowed.',
        '@nxtwave.co.in, @nxtwave.tech'
      )
    ).toBe('Only corporate emails are allowed (@nxtwave.co.in, @nxtwave.tech).')
  })

  it('returns the base message when hint is empty', () => {
    expect(
      appendAllowedDomainHint('Only corporate emails are allowed.', '')
    ).toBe('Only corporate emails are allowed.')
  })

  it('returns the base message when hint is whitespace', () => {
    expect(
      appendAllowedDomainHint('Only corporate emails are allowed.', '   ')
    ).toBe('Only corporate emails are allowed.')
  })
})
