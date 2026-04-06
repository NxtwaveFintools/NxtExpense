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

export const financeDashboardFilterSchema = z.object({
  dateFilterField: z
    .enum(['travel_date', 'submission_date'])
    .default('travel_date'),
  dateFrom: optionalDateField('Date from'),
  dateTo: optionalDateField('Date to'),
  designationId: z.string().uuid().optional(),
  workLocationId: z.string().uuid().optional(),
  stateId: z.string().uuid().optional(),
  employeeId: z.string().trim().min(1).optional(),
  employeeName: z.string().trim().min(1).optional(),
  vehicleCode: z.string().trim().min(1).optional(),
})

export type FinanceDashboardFilterInput = z.input<
  typeof financeDashboardFilterSchema
>
