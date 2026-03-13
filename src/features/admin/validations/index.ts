import { z } from 'zod'

export const adminRollbackSchema = z.object({
  claimId: z.string().uuid('Invalid claim identifier.'),
  reason: z
    .string()
    .trim()
    .min(1, 'Rollback reason is required.')
    .max(500, 'Rollback reason cannot exceed 500 characters.'),
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
  reason: z
    .string()
    .trim()
    .min(1, 'Reassignment reason is required.')
    .max(500, 'Reassignment reason cannot exceed 500 characters.'),
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

export type AdminRollbackInput = z.infer<typeof adminRollbackSchema>
export type AdminReassignApproverInput = z.infer<
  typeof adminReassignApproverSchema
>
export type AdminToggleActiveInput = z.infer<typeof adminToggleActiveSchema>
export type AdminUpdateRateInput = z.infer<typeof adminUpdateRateSchema>
export type AdminUpdateVehicleRatesInput = z.infer<
  typeof adminUpdateVehicleRatesSchema
>
