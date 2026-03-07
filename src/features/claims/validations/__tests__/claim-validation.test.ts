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

  it('rejects 2W outstation claim above 150km', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: '06/03/2026',
      workLocation: 'Field - Outstation',
      ownVehicleUsed: true,
      outstationLocation: 'Vijayawada',
      vehicleType: 'Two Wheeler',
      fromCity: 'Hyderabad',
      toCity: 'Vijayawada',
      kmTravelled: 180,
    })

    expect(parsed.success).toBe(false)
  })

  it('accepts outstation taxi flow without own vehicle', () => {
    const parsed = claimSubmissionSchema.safeParse({
      claimDate: '06/03/2026',
      workLocation: 'Field - Outstation',
      ownVehicleUsed: false,
      transportType: 'Rapido/Uber/Ola',
      outstationLocation: 'Bengaluru',
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
