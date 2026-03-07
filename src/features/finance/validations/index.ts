import { z } from 'zod'

import { parseDateDDMMYYYY, toISODate } from '@/lib/utils/date'

const FINANCE_ACTIONS = ['issued', 'finance_rejected'] as const
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

export const financeActionSchema = z
  .object({
    claimId: z.string().uuid('Invalid claim identifier.'),
    action: z.enum(FINANCE_ACTIONS),
    notes: z
      .string()
      .trim()
      .max(500, 'Notes cannot exceed 500 characters.')
      .optional(),
    allowResubmit: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (value.action === 'finance_rejected' && !value.notes?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['notes'],
        message: 'Notes are required for this finance action.',
      })
    }
  })

export const bulkFinanceActionSchema = z
  .object({
    claimIds: z.array(z.string().uuid('Invalid claim identifier.')).min(1),
    action: z.enum(['issued', 'finance_rejected']),
    notes: z
      .string()
      .trim()
      .max(500, 'Notes cannot exceed 500 characters.')
      .optional(),
    allowResubmit: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (value.action === 'finance_rejected' && !value.notes?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['notes'],
        message: 'Rejection notes are required for bulk reject.',
      })
    }
  })

export const financeFiltersSchema = z
  .object({
    employeeName: z.string().trim().max(100).optional(),
    claimNumber: z.string().trim().max(50).optional(),
    ownerDesignation: z.string().trim().max(100).optional(),
    hodApproverEmail: z.string().trim().email().optional(),
    actionFilter: z.enum(['all', 'issued', 'finance_rejected']).default('all'),
    claimDateFrom: optionalDateField('Claim date from'),
    claimDateTo: optionalDateField('Claim date to'),
    actionDateFrom: optionalDateField('Action date from'),
    actionDateTo: optionalDateField('Action date to'),
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

    if (
      value.actionDateFrom &&
      value.actionDateTo &&
      value.actionDateFrom > value.actionDateTo
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['actionDateTo'],
        message: 'Action date to must be on or after action date from.',
      })
    }
  })

export type FinanceActionInput = z.infer<typeof financeActionSchema>
export type BulkFinanceActionInput = z.infer<typeof bulkFinanceActionSchema>
export type FinanceFiltersInput = z.infer<typeof financeFiltersSchema>
