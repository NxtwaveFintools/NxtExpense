import { afterEach, describe, expect, it, vi } from 'vitest'

import { getSupabasePublicEnv } from '../env'

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const originalPublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

afterEach(() => {
  if (originalSupabaseUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
  } else {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', originalSupabaseUrl)
  }

  if (originalPublishableKey === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  } else {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', originalPublishableKey)
  }

  if (originalAnonKey === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  } else {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', originalAnonKey)
  }
})

describe('getSupabasePublicEnv', () => {
  it('prefers NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY when present', () => {
    vi.stubEnv(
      'NEXT_PUBLIC_SUPABASE_URL',
      'https://acbgmixcdtfgurgbkqgh.supabase.co'
    )
    vi.stubEnv(
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'sb_publishable_test_key'
    )
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'legacy_anon_key')

    const env = getSupabasePublicEnv()

    expect(env.url).toBe('https://acbgmixcdtfgurgbkqgh.supabase.co')
    expect(env.publishableKey).toBe('sb_publishable_test_key')
  })

  it('falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY when publishable key is missing', () => {
    vi.stubEnv(
      'NEXT_PUBLIC_SUPABASE_URL',
      'https://acbgmixcdtfgurgbkqgh.supabase.co'
    )
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'legacy_anon_key')

    const env = getSupabasePublicEnv()

    expect(env.publishableKey).toBe('legacy_anon_key')
  })

  it('throws when no public Supabase key is configured', () => {
    vi.stubEnv(
      'NEXT_PUBLIC_SUPABASE_URL',
      'https://acbgmixcdtfgurgbkqgh.supabase.co'
    )
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    expect(() => getSupabasePublicEnv()).toThrow(
      'Missing environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  })
})
