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
  baseDayTypeIncludeFoodByCode: {
    FULL_DAY: true,
    HALF_DAY: false,
  },
  baseDayTypeLabelByCode: {
    FULL_DAY: 'Full Day',
    HALF_DAY: 'Half Day (Fuel Only)',
  },
  defaultBaseDayTypeCode: 'FULL_DAY',
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
  it('shows food + fuel for base location full day', () => {
    const result = getClaimSummaryPreview({
      workLocation: 'wl-base',
      requiresVehicleSelection: true,
      requiresOutstationDetails: false,
      baseLocationDayTypeCode: 'FULL_DAY',
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

    expect(result.items).toEqual([
      { label: 'Food allowance', amount: 120 },
      { label: 'Two Wheeler fuel allowance', amount: 180 },
    ])
    expect(result.total).toBe(300)
  })

  it('shows fuel-only for base location half day', () => {
    const result = getClaimSummaryPreview({
      workLocation: 'wl-base',
      requiresVehicleSelection: true,
      requiresOutstationDetails: false,
      baseLocationDayTypeCode: 'HALF_DAY',
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

    expect(result.items).toEqual([
      {
        label: 'Two Wheeler fuel allowance (Half Day (Fuel Only))',
        amount: 180,
      },
    ])
    expect(result.total).toBe(180)
  })

  it('shows only food allowance when neither outstation own-vehicle branch is selected', () => {
    const result = getClaimSummaryPreview({
      workLocation: 'wl-outstation',
      requiresVehicleSelection: false,
      requiresOutstationDetails: true,
      baseLocationDayTypeCode: undefined,
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
      baseLocationDayTypeCode: undefined,
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
      { label: 'Two Wheeler fixed intra-city fuel allowance', amount: 180 },
    ])
    expect(result.total).toBe(530)
  })

  it('includes fixed fuel allowance when intra-city rented vehicle is selected', () => {
    const result = getClaimSummaryPreview({
      workLocation: 'wl-outstation',
      requiresVehicleSelection: false,
      requiresOutstationDetails: true,
      baseLocationDayTypeCode: undefined,
      hasIntercityTravel: false,
      hasIntracityTravel: true,
      intercityOwnVehicleUsed: false,
      intracityOwnVehicleUsed: false,
      vehicleType: 'veh-2w',
      vehicleTypeName: 'Two Wheeler',
      kmTravelled: '',
      foodWithPrincipalsAmount: '',
      claimRateSnapshot: RATE_SNAPSHOT,
    })

    expect(result.items).toEqual([
      { label: 'Food allowance', amount: 350 },
      {
        label:
          'Two Wheeler fixed intra-city fuel allowance (rented vehicle travel)',
        amount: 180,
      },
    ])
    expect(result.total).toBe(530)
  })

  it('includes inter-city KM and intra-city allowance when inter-city own vehicle is selected', () => {
    const result = getClaimSummaryPreview({
      workLocation: 'wl-outstation',
      requiresVehicleSelection: false,
      requiresOutstationDetails: true,
      baseLocationDayTypeCode: undefined,
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
      { label: 'Two Wheeler fixed intra-city fuel allowance', amount: 180 },
    ])
    expect(result.total).toBe(1030)
  })

  it('shows food allowance only when outstation own vehicle is not used', () => {
    const result = getClaimSummaryPreview({
      workLocation: 'wl-outstation',
      requiresVehicleSelection: false,
      requiresOutstationDetails: true,
      baseLocationDayTypeCode: undefined,
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
