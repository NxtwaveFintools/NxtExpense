import { describe, expect, it } from 'vitest'

import { INPUT_DEBOUNCE_MS } from '../ui'

describe('ui timing constants', () => {
  it('debounces text inputs at 400ms', () => {
    expect(INPUT_DEBOUNCE_MS).toBe(400)
  })
})
