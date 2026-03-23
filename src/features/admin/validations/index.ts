import { z } from 'zod'

export const adminStatusChangeSchema = z.object({
  claimId: z.string().uuid('Invalid claim identifier.'),
  targetStatusId: z.string().uuid('Target status is required.'),
  reason: z.string().trim().min(1, 'Status change reason is required.'),
  confirmation: z.literal('CONFIRM', 'Secondary confirmation is required.'),
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
  confirmation: z.literal('CONFIRM', 'Secondary confirmation is required.'),
})

export const adminToggleActiveSchema = z.object({
  id: z.string().uuid('Invalid identifier.'),
  isActive: z.boolean(),
})

export const adminUpdateRateSchema = z.object({
  id: z.string().uuid('Invalid rate identifier.'),
  rateAmount: z.number().min(0, 'Rate amount must be non-negative.'),
})

export const adminUpdateVehicleRatesSchema = z.object({
  id: z.string().uuid('Invalid vehicle type identifier.'),
  baseFuelRatePerDay: z.number().min(0, 'Rate must be non-negative.'),
  intercityRatePerKm: z.number().min(0, 'Rate must be non-negative.'),
  maxKmRoundTrip: z.number().int().min(0, 'KM limit must be non-negative.'),
})

const optionalUuidSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}, z.string().uuid('Invalid approver selected.').optional())

const optionalPasswordSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}, z.string().min(6, 'Login password must be at least 6 characters.').max(72, 'Login password cannot exceed 72 characters.').optional())

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
  confirmation: z.literal('CONFIRM', 'Secondary confirmation is required.'),
})

export function normalizeOptionalUuid(value?: string): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}
