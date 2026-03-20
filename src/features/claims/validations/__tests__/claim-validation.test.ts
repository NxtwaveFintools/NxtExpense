import { describe, expect, it } from 'vitest'

import { claimSubmissionSchema } from '@/features/claims/validations'

describe('claimSubmissionSchema', () => {
  it('accepts office claim with only date', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: '06/03/2026',
      workLocation: 'Office / WFH',
    })

    expect(parsed.success).toBe(true)
  })

  it('accepts office claim when optional outstation fields are empty strings', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: '06/03/2026',
      workLocation: 'Office / WFH',
      outstationCityId: '',
      fromCityId: '',
      toCityId: '',
      vehicleType: '',
    })

    expect(parsed.success).toBe(true)
  })

  it('accepts 2W outstation claim above 150km at schema level (KM limit validated server-side)', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: '06/03/2026',
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationCityId: 'mock-city-uuid',
      vehicleType: 'Two Wheeler',
      fromCityId: 'mock-city-uuid',
      toCityId: 'mock-city-uuid',
      kmTravelled: 180,
    })

    expect(parsed.success).toBe(true)
  })

  it('accepts outstation flow without own vehicle and without extra transport fields', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: '06/03/2026',
      workLocation: 'Field - Outstation',
      ownVehicleUsed: false,
      outstationCityId: 'mock-city-uuid',
    })

    expect(parsed.success).toBe(true)
  })

  it('rejects future date', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: '06/03/2099',
      workLocation: 'Leave',
    })

    expect(parsed.success).toBe(false)
  })
})
