import { describe, expect, it } from 'vitest'

import { config } from '../../middleware'
import { buildMiddlewareMatcher } from '@/lib/auth/route-access'

// Guards the one duplication Next.js forces on us: `config.matcher` must be a
// static literal in middleware.ts, but it has to stay equal to the route lists
// in route-access.ts. If either side changes without the other, this fails.
describe('middleware config.matcher', () => {
  it('stays in sync with the route-access route lists', () => {
    expect(config.matcher).toEqual(buildMiddlewareMatcher())
  })
})
