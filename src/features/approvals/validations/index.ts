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

export const approvalActionSchema = z.object({
  claimId: z.string().uuid('Invalid claim identifier.'),
  action: z.string().trim().min(1, 'Action is required.'),
  notes: z
    .string()
    .trim()
    .max(500, 'Notes cannot exceed 500 characters.')
    .optional(),
  allowResubmit: z.boolean().optional(),
})

export const approvalHistoryFiltersSchema = z
  .object({
    employeeName: z.string().trim().max(100).optional(),
    claimStatus: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.string().trim().uuid().optional()
    ),
    claimDate: optionalDateField('Claim date'),
    hodApprovedFrom: optionalDateField('HOD approval date from'),
    hodApprovedTo: optionalDateField('HOD approval date to'),
    financeApprovedFrom: optionalDateField('Finance approval date from'),
    financeApprovedTo: optionalDateField('Finance approval date to'),
  })
  .superRefine((value, context) => {
    function checkRange(
      from: string | undefined,
      to: string | undefined,
      path: string,
      label: string
    ) {
      if (from && to && from > to) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [path],
          message: `${label} to must be on or after ${label.toLowerCase()} from.`,
        })
      }
    }
    checkRange(
      value.hodApprovedFrom,
      value.hodApprovedTo,
      'hodApprovedTo',
      'HOD approval date'
    )
    checkRange(
      value.financeApprovedFrom,
      value.financeApprovedTo,
      'financeApprovedTo',
      'Finance approval date'
    )
  })

export const bulkApprovalActionSchema = z.object({
  claimIds: z.array(z.string().uuid('Invalid claim identifier.')).min(1),
  action: z.string().trim().min(1, 'Action is required.'),
  notes: z
    .string()
    .trim()
    .max(500, 'Notes cannot exceed 500 characters.')
    .optional(),
  allowResubmit: z.boolean().optional(),
})
