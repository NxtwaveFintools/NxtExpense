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
      transportType: '',
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

  it('accepts outstation taxi flow without own vehicle', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: '06/03/2026',
      workLocation: 'Field - Outstation',
      ownVehicleUsed: false,
      transportType: 'Rapido/Uber/Ola',
      outstationCityId: 'mock-city-uuid',
      taxiAmount: 450,
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
