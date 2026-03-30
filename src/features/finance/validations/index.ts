import { z } from 'zod'

import { parseDateDDMMYYYY, toISODate } from '@/lib/utils/date'
import { isValidClaimStatusFilterValue } from '@/lib/utils/claim-status-filter'

const FINANCE_DATE_FILTER_FIELD_VALUES = [
  'claim_date',
  'finance_approved_date',
] as const

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const financeClaimStatusFilterSchema = z
  .string()
  .trim()
  .refine(isValidClaimStatusFilterValue, 'Invalid claim status filter.')

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

export const financeActionSchema = z.object({
  claimId: z.string().uuid('Invalid claim identifier.'),
  action: z.string().trim().min(1, 'Action is required.'),
  notes: z.string().trim().optional(),
  allowResubmit: z.boolean().optional(),
})

export const bulkFinanceActionSchema = z.object({
  claimIds: z.array(z.string().uuid('Invalid claim identifier.')).min(1),
  action: z.string().trim().min(1, 'Action is required.'),
  notes: z.string().trim().optional(),
  allowResubmit: z.boolean().optional(),
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
    claimStatus: z.preprocess(
      (val) => (val === '' ? undefined : val),
      financeClaimStatusFilterSchema.optional()
    ),
    workLocation: z.string().trim().max(100).optional(),
    actionFilter: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.string().trim().min(1).optional()
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
