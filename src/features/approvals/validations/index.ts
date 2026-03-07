import { z } from 'zod'

import { parseDateDDMMYYYY, toISODate } from '@/lib/utils/date'

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

export const approvalActionSchema = z
  .object({
    claimId: z.string().uuid('Invalid claim identifier.'),
    action: z.enum(['approved', 'rejected']),
    notes: z
      .string()
      .trim()
      .max(500, 'Notes cannot exceed 500 characters.')
      .optional(),
    allowResubmit: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (value.action === 'rejected' && !value.notes?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['notes'],
        message: 'Rejection notes are required.',
      })
    }
  })

export type ApprovalActionInput = z.infer<typeof approvalActionSchema>

export const approvalHistoryFiltersSchema = z
  .object({
    employeeName: z.string().trim().max(100).optional(),
    actorFilter: z.enum(['all', 'sbh', 'hod', 'finance']).default('all'),
    claimDateFrom: optionalDateField('Claim date from'),
    claimDateTo: optionalDateField('Claim date to'),
    hodApprovedFrom: optionalDateField('HOD approval from'),
    hodApprovedTo: optionalDateField('HOD approval to'),
    financeApprovedFrom: optionalDateField('Finance approval from'),
    financeApprovedTo: optionalDateField('Finance approval to'),
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
      value.hodApprovedFrom &&
      value.hodApprovedTo &&
      value.hodApprovedFrom > value.hodApprovedTo
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hodApprovedTo'],
        message: 'HOD approval to must be on or after HOD approval from.',
      })
    }

    if (
      value.financeApprovedFrom &&
      value.financeApprovedTo &&
      value.financeApprovedFrom > value.financeApprovedTo
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['financeApprovedTo'],
        message:
          'Finance approval to must be on or after finance approval from.',
      })
    }
  })

export const bulkApprovalActionSchema = z
  .object({
    claimIds: z.array(z.string().uuid('Invalid claim identifier.')).min(1),
    action: z.enum(['approved', 'rejected']),
    notes: z
      .string()
      .trim()
      .max(500, 'Notes cannot exceed 500 characters.')
      .optional(),
    allowResubmit: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (value.action === 'rejected' && !value.notes?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['notes'],
        message: 'Rejection notes are required.',
      })
    }
  })

export type ApprovalHistoryFiltersInput = z.infer<
  typeof approvalHistoryFiltersSchema
>

export type BulkApprovalActionInput = z.infer<typeof bulkApprovalActionSchema>
