import { z } from 'zod'

import { claimDateSchema } from '@/lib/validations/claim'
import { parseDateDDMMYYYY, toISODate } from '@/lib/utils/date'
import { isValidClaimStatusFilterValue } from '@/lib/utils/claim-status-filter'

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

function optionalNonEmptyStringField() {
  return z.preprocess((value) => {
    if (typeof value !== 'string') return value
    const normalized = value.trim()
    return normalized === '' ? undefined : normalized
  }, z.string().min(1).optional())
}

/**
 * Unified claim submission schema.
 * Work location is validated as a non-empty string — the actual DB lookup
 * and flag-based conditional logic happens in the server action.
 * Conditional field requirements (vehicle, outstation details) are also
 * enforced server-side using the DB flags.
 */
export const claimSubmissionSchema = z.object({
  claimDate: claimDateSchema,
  workLocation: z.string().trim().min(1, 'Work location is required.'),
  baseLocationDayTypeCode: optionalNonEmptyStringField(),
  ownVehicleUsed: z.boolean().optional(),
  hasIntercityTravel: z.boolean().optional(),
  hasIntracityTravel: z.boolean().optional(),
  intracityTravelUsed: z.boolean().optional(),
  intercityOwnVehicleUsed: z.boolean().optional(),
  intracityOwnVehicleUsed: z.boolean().optional(),
  intracityVehicleMode: z.enum(['OWN_VEHICLE', 'RENTAL_VEHICLE']).optional(),
  vehicleType: optionalNonEmptyStringField(),
  outstationStateId: optionalNonEmptyStringField(),
  outstationCityId: optionalNonEmptyStringField(),
  fromCityId: optionalNonEmptyStringField(),
  toCityId: optionalNonEmptyStringField(),
  kmTravelled: z.coerce.number().optional(),
  foodWithPrincipalsAmount: z.coerce
    .number()
    .min(0, 'Food with principals amount cannot be negative.')
    .optional(),
})

export const myClaimsFiltersSchema = z
  .object({
    claimStatus: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z
        .string()
        .trim()
        .refine(isValidClaimStatusFilterValue, 'Invalid claim status filter.')
        .optional()
    ),
    workLocation: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.string().trim().max(100).optional()
    ),
    claimDateFrom: optionalDateField('Claim date from'),
    claimDateTo: optionalDateField('Claim date to'),
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
        message: 'From Date cannot be later than To Date',
      })
    }
  })
