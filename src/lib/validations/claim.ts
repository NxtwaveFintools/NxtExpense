import { z } from 'zod'

import {
  isValidClaimDate,
  parseDateDDMMYYYY,
  toISODate,
} from '@/lib/utils/date'

const WORK_LOCATION_VALUES = [
  'Office / WFH',
  'Field - Base Location',
  'Field - Outstation',
  'Leave',
  'Week-off',
] as const

const VEHICLE_TYPE_VALUES = ['Two Wheeler', 'Four Wheeler'] as const

export const workLocationSchema = z.enum(WORK_LOCATION_VALUES)
export const vehicleTypeSchema = z.enum(VEHICLE_TYPE_VALUES)

export const claimDateSchema = z
  .string()
  .trim()
  .min(1, 'Claim date is required.')
  .transform((value, context) => {
    try {
      const parsedDate = parseDateDDMMYYYY(value)

      if (!isValidClaimDate(parsedDate)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Future dates are not allowed.',
        })
        return z.NEVER
      }

      return {
        display: value,
        parsed: parsedDate,
        iso: toISODate(parsedDate),
      }
    } catch (error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          error instanceof Error
            ? error.message
            : 'Date must be in DD/MM/YYYY format.',
      })
      return z.NEVER
    }
  })

export type WorkLocation = z.infer<typeof workLocationSchema>
export type VehicleType = z.infer<typeof vehicleTypeSchema>
export type ParsedClaimDate = z.infer<typeof claimDateSchema>
