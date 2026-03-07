import { z } from 'zod'

import { claimDateSchema } from '@/lib/validations/claim'

const TRANSPORT_TYPE_VALUES = ['Rental Vehicle', 'Rapido/Uber/Ola'] as const

const baseClaimShape = {
  claimDate: claimDateSchema,
}

const officeSchema = z.object({
  ...baseClaimShape,
  workLocation: z.literal('Office / WFH'),
})

const leaveSchema = z.object({
  ...baseClaimShape,
  workLocation: z.literal('Leave'),
})

const weekOffSchema = z.object({
  ...baseClaimShape,
  workLocation: z.literal('Week-off'),
})

const baseLocationSchema = z.object({
  ...baseClaimShape,
  workLocation: z.literal('Field - Base Location'),
  vehicleType: z.enum(['Two Wheeler', 'Four Wheeler']),
})

const outstationTaxiSchema = z.object({
  ...baseClaimShape,
  workLocation: z.literal('Field - Outstation'),
  ownVehicleUsed: z.literal(false),
  transportType: z.enum(TRANSPORT_TYPE_VALUES),
  outstationLocation: z
    .string()
    .trim()
    .min(1, 'Outstation location is required.'),
  taxiAmount: z.coerce
    .number()
    .min(0, 'Taxi amount cannot be negative.')
    .optional(),
})

const outstationOwnVehicleSchema = z.object({
  ...baseClaimShape,
  workLocation: z.literal('Field - Outstation'),
  ownVehicleUsed: z.literal(true),
  outstationLocation: z
    .string()
    .trim()
    .min(1, 'Outstation location is required.'),
  vehicleType: z.enum(['Two Wheeler', 'Four Wheeler']),
  fromCity: z.string().trim().min(1, 'From city is required.'),
  toCity: z.string().trim().min(1, 'To city is required.'),
  kmTravelled: z.coerce
    .number()
    .positive('KM travelled must be greater than zero.'),
})

export const claimSubmissionSchema = z
  .union([
    officeSchema,
    leaveSchema,
    weekOffSchema,
    baseLocationSchema,
    outstationTaxiSchema,
    outstationOwnVehicleSchema,
  ])
  .superRefine((value, context) => {
    if (value.workLocation !== 'Field - Outstation' || !value.ownVehicleUsed) {
      return
    }

    const kmLimit = value.vehicleType === 'Two Wheeler' ? 150 : 300
    if (value.kmTravelled > kmLimit) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['kmTravelled'],
        message: `KM travelled exceeds max limit of ${kmLimit} for ${value.vehicleType}.`,
      })
    }
  })

export type ClaimSubmissionInput = z.infer<typeof claimSubmissionSchema>
