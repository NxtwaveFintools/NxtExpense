import type { SupabaseClient } from '@supabase/supabase-js'

import { getAllowedEmailDomains } from '@/lib/services/config-service'

function getEmailDomain(email: string): string | null {
  const normalizedEmail = email.trim().toLowerCase()
  const atIndex = normalizedEmail.lastIndexOf('@')
  if (atIndex === -1 || atIndex === normalizedEmail.length - 1) return null
  return normalizedEmail.slice(atIndex + 1)
}

export function isDomainAllowed(
  domains: string[],
  email: string | null | undefined
): boolean {
  if (!email) return false
  const domain = getEmailDomain(email)
  if (!domain) return false
  return domains.some((d) => d.toLowerCase() === domain)
}

function normalizeDomainList(domains: string[]): string[] {
  return [
    ...new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean)),
  ]
}

export async function isAllowedCorporateEmail(
  supabase: SupabaseClient,
  email: string | null | undefined
): Promise<boolean> {
  const domains = await getAllowedEmailDomains(supabase)
  return isDomainAllowed(domains, email)
}

export async function getAllowedCorporateEmailHint(
  supabase: SupabaseClient
): Promise<string> {
  const domains = normalizeDomainList(await getAllowedEmailDomains(supabase))
  return domains.map((d) => `@${d}`).join(', ')
}

export function appendAllowedDomainHint(
  baseMessage: string,
  hint: string | null | undefined
): string {
  const normalizedHint = hint?.trim()
  if (!normalizedHint) return baseMessage

  const normalizedMessage = baseMessage.endsWith('.')
    ? baseMessage.slice(0, -1)
    : baseMessage

  return `${normalizedMessage} (${normalizedHint}).`
}
