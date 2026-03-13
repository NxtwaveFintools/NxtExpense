import { z } from 'zod'

import { parseDateDDMMYYYY, toISODate } from '@/lib/utils/date'

// These values mirror the `finance_action_type` PostgreSQL enum.
// They can only change via a DB migration — single source of truth is the DB schema.
const FINANCE_ACTION_VALUES = ['issued', 'finance_rejected'] as const
const FINANCE_FILTER_VALUES = ['all', 'issued', 'finance_rejected'] as const
const FINANCE_DATE_FILTER_FIELD_VALUES = [
  'claim_date',
  'finance_approved_date',
] as const

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
    action: z.enum(FINANCE_ACTION_VALUES),
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
    action: z.enum(FINANCE_ACTION_VALUES),
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
    // HTML GET forms submit empty string for the blank <option value="">.
    // Preprocess '' → undefined so the UUID validator accepts it as "no filter".
    hodApproverEmployeeId: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.string().trim().uuid().optional()
    ),
    claimStatus: z.string().trim().max(100).optional(),
    workLocation: z.string().trim().max(100).optional(),
    actionFilter: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.enum(FINANCE_FILTER_VALUES).default('all')
    ),
    dateFilterField: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.enum(FINANCE_DATE_FILTER_FIELD_VALUES).default('claim_date')
    ),
    dateFrom: optionalDateField('Date from'),
    dateTo: optionalDateField('Date to'),
  })
  .superRefine((value, context) => {
    if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dateTo'],
        message: 'Date to must be on or after date from.',
      })
    }
  })

export type FinanceActionInput = z.infer<typeof financeActionSchema>
export type BulkFinanceActionInput = z.infer<typeof bulkFinanceActionSchema>
export type FinanceFiltersInput = z.infer<typeof financeFiltersSchema>
