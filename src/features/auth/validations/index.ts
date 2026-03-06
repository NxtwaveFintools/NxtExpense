import { z } from 'zod'

import {
  getAllowedCorporateEmailHint,
  isAllowedCorporateEmail,
} from '@/lib/auth/allowed-email-domains'

export const emailPasswordLoginSchema = z.object({
  email: z
    .string()
    .email('Enter a valid email address.')
    .refine(isAllowedCorporateEmail, {
      message: `Only corporate emails are allowed (${getAllowedCorporateEmailHint()}).`,
    }),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
})

export type EmailPasswordLoginInput = z.infer<typeof emailPasswordLoginSchema>
