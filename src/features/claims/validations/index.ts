import { z } from 'zod'

import { claimDateSchema } from '@/lib/validations/claim'
import { parseDateDDMMYYYY, toISODate } from '@/lib/utils/date'
import { WORK_LOCATION_FILTER_VALUES } from '@/features/claims/types'

const TRANSPORT_TYPE_VALUES = ['Rental Vehicle', 'Rapido/Uber/Ola'] as const
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function optionalDateField(label: string) {
  return z
    .string()
    .trim()
    .optional()
    .transform((value, context) => {
      if (!value) {
        return undefined
      }

      if (ISO_DATE_REGEX.test(value)) {
        return value
      }

      try {
        return toISODate(parseDateDDMMYYYY(value))
      } catch {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be in DD/MM/YYYY format.`,
        })
        return z.NEVER
      }
    })
}

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

export const myClaimsFiltersSchema = z
  .object({
    claimStatus: z.string().trim().max(100).optional(),
    // HTML GET forms submit empty string for unselected fields.
    // Preprocess '' → undefined so the enum validator accepts it as "no filter".
    workLocation: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.enum(WORK_LOCATION_FILTER_VALUES).optional()
    ),
    claimDateFrom: optionalDateField('Claim date from'),
    claimDateTo: optionalDateField('Claim date to'),
    resubmittedOnly: z
      .enum(['true', '1', 'on'])
      .optional()
      .transform((value) => Boolean(value)),
  })
  .superRefine((value, context) => {
    if (
      value.claimDateFrom &&
      value.claimDateTo &&
      value.claimDateFrom > value.claimDateTo
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['claimDateTo'],
        message: 'Claim date to must be on or after claim date from.',
      })
    }
  })

export type ClaimSubmissionInput = z.infer<typeof claimSubmissionSchema>
export type MyClaimsFiltersInput = z.infer<typeof myClaimsFiltersSchema>
