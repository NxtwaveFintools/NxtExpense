const ALLOWED_EMAIL_DOMAINS = [
  'nxtwave.co.in',
  'nxtwave.tech',
  'nxtwave.in',
] as const

type AllowedEmailDomain = (typeof ALLOWED_EMAIL_DOMAINS)[number]

function getEmailDomain(email: string): string | null {
  const normalizedEmail = email.trim().toLowerCase()
  const atIndex = normalizedEmail.lastIndexOf('@')
  if (atIndex === -1 || atIndex === normalizedEmail.length - 1) return null
  return normalizedEmail.slice(atIndex + 1)
}

export function isAllowedCorporateEmail(
  email: string | null | undefined
): boolean {
  if (!email) return false
  const domain = getEmailDomain(email)
  if (!domain) return false
  return ALLOWED_EMAIL_DOMAINS.includes(domain as AllowedEmailDomain)
}

export function getAllowedCorporateEmailHint(): string {
  return ALLOWED_EMAIL_DOMAINS.map((domain) => `@${domain}`).join(', ')
}
