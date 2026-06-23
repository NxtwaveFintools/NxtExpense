import { z } from 'zod'

import {
  MAX_APPROVAL_LEVEL,
  MIN_APPROVAL_LEVEL,
} from '@/lib/constants/approval-levels'
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@/lib/constants/auth'

const secondaryConfirmationSchema = z.literal(
  'CONFIRM',
  'Secondary confirmation is required.'
)

const APPROVAL_LEVEL_RANGE_MESSAGE = `Approval level must be between ${MIN_APPROVAL_LEVEL} and ${MAX_APPROVAL_LEVEL}.`

export const adminStatusChangeSchema = z.object({
  claimId: z.string().uuid('Invalid claim identifier.'),
  targetStatusId: z.string().uuid('Target status is required.'),
  reason: z.string().trim().min(1, 'Status change reason is required.'),
  confirmation: secondaryConfirmationSchema,
})

const adminEmailSchema = z
  .string()
  .trim()
  .email('Invalid approver email.')
  .optional()

export const adminReassignApproverSchema = z.object({
  employeeId: z.string().uuid('Invalid employee identifier.'),
  approvalLevel1: adminEmailSchema,
  approvalLevel2: adminEmailSchema,
  approvalLevel3: adminEmailSchema,
  reason: z.string().trim().min(1, 'Reassignment reason is required.'),
  confirmation: secondaryConfirmationSchema,
})

export const adminToggleActiveSchema = z.object({
  id: z.string().uuid('Invalid identifier.'),
  isActive: z.boolean(),
  confirmation: secondaryConfirmationSchema,
})

export const adminUpdateRateSchema = z.object({
  id: z.string().uuid('Invalid rate identifier.'),
  rateAmount: z.number().min(0, 'Rate amount must be non-negative.'),
  confirmation: secondaryConfirmationSchema,
})

export const adminUpdateVehicleRatesSchema = z.object({
  id: z.string().uuid('Invalid vehicle type identifier.'),
  baseFuelRatePerDay: z.number().min(0, 'Rate must be non-negative.'),
  intercityRatePerKm: z.number().min(0, 'Rate must be non-negative.'),
  maxKmRoundTrip: z.number().int().min(0, 'KM limit must be non-negative.'),
  confirmation: secondaryConfirmationSchema,
})

export const adminUpsertApproverRuleSchema = z.object({
  approvalLevel: z
    .number()
    .int()
    .min(MIN_APPROVAL_LEVEL, APPROVAL_LEVEL_RANGE_MESSAGE)
    .max(MAX_APPROVAL_LEVEL, APPROVAL_LEVEL_RANGE_MESSAGE),
  designationId: z.string().uuid('Invalid designation identifier.'),
  requiresSameState: z.boolean(),
  isActive: z.boolean(),
  confirmation: secondaryConfirmationSchema,
})

const stateNameSchema = z
  .string()
  .trim()
  .min(1, 'State name is required.')
  .max(120, 'State name must be 120 characters or fewer.')

const cityNameSchema = z
  .string()
  .trim()
  .min(1, 'City name is required.')
  .max(120, 'City name must be 120 characters or fewer.')

export const adminCreateStateSchema = z.object({
  stateName: stateNameSchema,
  confirmation: secondaryConfirmationSchema,
})

export const adminUpdateStateSchema = z.object({
  id: z.string().uuid('Invalid state identifier.'),
  stateName: stateNameSchema,
  confirmation: secondaryConfirmationSchema,
})

export const adminCreateCitySchema = z.object({
  stateId: z.string().uuid('Invalid state identifier.'),
  cityName: cityNameSchema,
  confirmation: secondaryConfirmationSchema,
})

export const adminUpdateCitySchema = z.object({
  id: z.string().uuid('Invalid city identifier.'),
  cityName: cityNameSchema,
  confirmation: secondaryConfirmationSchema,
})

export const adminBulkImportCitiesSchema = z.object({
  stateId: z.string().uuid('Invalid state identifier.'),
  rawInput: z
    .string()
    .trim()
    .min(1, 'At least one city is required for import.')
    .max(20_000, 'Bulk city input is too large.'),
  confirmation: secondaryConfirmationSchema,
})

const optionalUuidSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}, z.string().uuid('Invalid approver selected.').optional())

const optionalPasswordSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value
    }

    const trimmed = value.trim()
    return trimmed.length === 0 ? undefined : trimmed
  },
  z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `Login password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    )
    .max(
      MAX_PASSWORD_LENGTH,
      `Login password cannot exceed ${MAX_PASSWORD_LENGTH} characters.`
    )
    .optional()
)

export const adminCreateEmployeeSchema = z
  .object({
    employeeId: z.string().trim().min(1, 'Employee ID is required.'),
    employeeName: z.string().trim().min(1, 'Employee name is required.'),
    employeeEmail: z
      .string()
      .trim()
      .email('Valid employee email is required.')
      .transform((value) => value.toLowerCase()),
    designationId: z.string().uuid('Designation is required.'),
    employeeStatusId: z.string().uuid('Employee status is required.'),
    roleId: z.string().uuid('Role is required.'),
    stateId: z.string().uuid('Primary state is required.'),
    approvalEmployeeIdLevel1: optionalUuidSchema,
    approvalEmployeeIdLevel2: optionalUuidSchema,
    approvalEmployeeIdLevel3: optionalUuidSchema,
    loginPassword: optionalPasswordSchema,
    replacementEmployeeId: optionalUuidSchema,
    replacementReason: z
      .string()
      .trim()
      .min(1, 'Replacement reason is required.')
      .max(500, 'Replacement reason cannot exceed 500 characters.')
      .optional(),
    replacementConfirmation: z.literal('CONFIRM').optional(),
  })
  .superRefine((value, ctx) => {
    const hasReplacementEmployee = Boolean(value.replacementEmployeeId)
    const hasReplacementReason = Boolean(value.replacementReason)

    if (hasReplacementEmployee !== hasReplacementReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Replacement employee and reason must be provided together.',
        path: ['replacementReason'],
      })
    }

    if (hasReplacementEmployee && value.replacementConfirmation !== 'CONFIRM') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Replacement confirmation is required.',
        path: ['replacementConfirmation'],
      })
    }
  })

export const adminPrepareReplacementSchema = z.object({
  employeeId: z.string().uuid('Invalid employee identifier.'),
  reason: z
    .string()
    .trim()
    .min(1, 'Replacement reason is required.')
    .max(500, 'Replacement reason cannot exceed 500 characters.'),
  confirmation: secondaryConfirmationSchema,
})

export function normalizeOptionalUuid(value?: string): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}
