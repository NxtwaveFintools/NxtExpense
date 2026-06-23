import { z } from 'zod'

import { MIN_PASSWORD_LENGTH } from '@/lib/constants/auth'

export const emailPasswordLoginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    ),
})
