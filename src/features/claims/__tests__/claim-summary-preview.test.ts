import { describe, expect, it } from 'vitest'

import {
  getClaimSummaryPreview,
  type ClaimRateSnapshot,
} from '@/features/claims/components/claim-summary-preview'

const RATE_SNAPSHOT: ClaimRateSnapshot = {
  foodBaseDaily: 120,
  foodOutstationDaily: 350,
  fuelBaseDailyByVehicle: {
    'veh-2w': 180,
  },
  intercityPerKmByVehicle: {
    'veh-2w': 5,
  },
  intracityDailyByVehicle: {
    'veh-2w': 180,
  },
  maxKmRoundTripByVehicle: {
    'veh-2w': 150,
  },
  foodWithPrincipalsMax: 500,
}

describe('getClaimSummaryPreview', () => {
  it('shows only food allowance when neither outstation own-vehicle branch is selected', () => {
    const result = getClaimSummaryPreview({
      workLocation: 'wl-outstation',
      requiresVehicleSelection: false,
      requiresOutstationDetails: true,
      hasIntercityTravel: false,
      hasIntracityTravel: false,
      intercityOwnVehicleUsed: false,
      intracityOwnVehicleUsed: false,
      vehicleType: 'veh-2w',
      vehicleTypeName: 'Two Wheeler',
      kmTravelled: '',
      foodWithPrincipalsAmount: '',
      claimRateSnapshot: RATE_SNAPSHOT,
    })

    expect(result.items).toEqual([{ label: 'Food allowance', amount: 350 }])
    expect(result.total).toBe(350)
  })

  it('includes intra-city allowance when intra-city own vehicle is selected', () => {
    const result = getClaimSummaryPreview({
      workLocation: 'wl-outstation',
      requiresVehicleSelection: false,
      requiresOutstationDetails: true,
      hasIntercityTravel: false,
      hasIntracityTravel: true,
      intercityOwnVehicleUsed: false,
      intracityOwnVehicleUsed: true,
      vehicleType: 'veh-2w',
      vehicleTypeName: 'Two Wheeler',
      kmTravelled: '',
      foodWithPrincipalsAmount: '',
      claimRateSnapshot: RATE_SNAPSHOT,
    })

    expect(result.items).toEqual([
      { label: 'Food allowance', amount: 350 },
      { label: 'Two Wheeler intra-city allowance', amount: 180 },
    ])
    expect(result.total).toBe(530)
  })

  it('includes inter-city KM and intra-city allowance when inter-city own vehicle is selected', () => {
    const result = getClaimSummaryPreview({
      workLocation: 'wl-outstation',
      requiresVehicleSelection: false,
      requiresOutstationDetails: true,
      hasIntercityTravel: true,
      hasIntracityTravel: false,
      intercityOwnVehicleUsed: true,
      intracityOwnVehicleUsed: false,
      vehicleType: 'veh-2w',
      vehicleTypeName: 'Two Wheeler',
      kmTravelled: '100',
      foodWithPrincipalsAmount: '',
      claimRateSnapshot: RATE_SNAPSHOT,
    })

    expect(result.items).toEqual([
      { label: 'Food allowance', amount: 350 },
      { label: 'Intercity travel (100.00 KM @ 5.00/KM)', amount: 500 },
      { label: 'Two Wheeler intra-city allowance', amount: 180 },
    ])
    expect(result.total).toBe(1030)
  })

  it('shows food allowance only when outstation own vehicle is not used', () => {
    const result = getClaimSummaryPreview({
      workLocation: 'wl-outstation',
      requiresVehicleSelection: false,
      requiresOutstationDetails: true,
      hasIntercityTravel: false,
      hasIntracityTravel: false,
      intercityOwnVehicleUsed: false,
      intracityOwnVehicleUsed: false,
      vehicleType: 'veh-2w',
      vehicleTypeName: 'Two Wheeler',
      kmTravelled: '',
      foodWithPrincipalsAmount: '',
      claimRateSnapshot: RATE_SNAPSHOT,
    })

    expect(result.items).toEqual([{ label: 'Food allowance', amount: 350 }])
    expect(result.total).toBe(350)
  })
})
