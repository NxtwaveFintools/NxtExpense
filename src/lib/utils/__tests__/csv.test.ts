import { describe, expect, it } from 'vitest'

import { sanitizeCsvValue, toCsvCell } from '@/lib/utils/csv'

describe('csv utils', () => {
  it('quotes and escapes standard values', () => {
    expect(toCsvCell('Hello, "Finance"')).toBe('"Hello, ""Finance"""')
  })

  it('neutralizes formula payloads by prefixing apostrophe', () => {
    expect(sanitizeCsvValue('=1+1')).toBe("'=1+1")
    expect(sanitizeCsvValue('+SUM(A1:A2)')).toBe("'+SUM(A1:A2)")
    expect(sanitizeCsvValue('-cmd')).toBe("'-cmd")
    expect(sanitizeCsvValue('@evil')).toBe("'@evil")
  })

  it('applies formula neutralization inside CSV cells', () => {
    expect(toCsvCell('=2+2')).toBe('"\'=2+2"')
  })

  it('leaves non-formula values unchanged before quoting', () => {
    expect(sanitizeCsvValue('NXT-EMP-1001')).toBe('NXT-EMP-1001')
    expect(toCsvCell('NXT-EMP-1001')).toBe('"NXT-EMP-1001"')
  })
})
