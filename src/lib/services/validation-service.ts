import type { SupabaseClient } from '@supabase/supabase-js'

import {
  getValidationRules,
  getClaimStatusTransitions,
  type ClaimStatusTransition,
} from '@/lib/services/config-service'

// ────────────────────────────────────────────────────────────
// Validation rule codes (must match validation_rules.rule_code in DB)
// ────────────────────────────────────────────────────────────

const RULE_CODES = {
  MAX_CLAIM_DAYS: 'MAX_CLAIM_DAYS',
  FUTURE_DATE_ALLOWED: 'FUTURE_DATE_ALLOWED',
  FUEL_TAXI_MUTUAL_EXCLUSION: 'FUEL_TAXI_MUTUAL_EXCLUSION',
  MAX_TAXI_BILLS_PER_DAY: 'MAX_TAXI_BILLS_PER_DAY',
  MAX_FUEL_ENTRIES_PER_DAY: 'MAX_FUEL_ENTRIES_PER_DAY',
  DUPLICATE_CLAIM_CHECK: 'DUPLICATE_CLAIM_CHECK',
} as const

type RuleCode = (typeof RULE_CODES)[keyof typeof RULE_CODES]

export type ValidationRuleMap = Record<string, string>

// ────────────────────────────────────────────────────────────
// Load all rules into a map for fast access
// ────────────────────────────────────────────────────────────

export async function loadValidationRules(
  supabase: SupabaseClient
): Promise<ValidationRuleMap> {
  const rules = await getValidationRules(supabase)
  const map: ValidationRuleMap = {}
  for (const rule of rules) {
    map[rule.rule_code] = rule.rule_value
  }
  return map
}

function getRuleValue(rules: ValidationRuleMap, code: RuleCode): string {
  const value = rules[code]
  if (value === undefined) {
    throw new Error(`Validation rule '${code}' not found in database.`)
  }
  return value
}

// ────────────────────────────────────────────────────────────
// Date range validation
// ────────────────────────────────────────────────────────────

export function checkDateRange(
  fromDate: Date,
  toDate: Date,
  rules: ValidationRuleMap
): { valid: boolean; error?: string } {
  const maxDays = parseInt(getRuleValue(rules, RULE_CODES.MAX_CLAIM_DAYS), 10)

  if (isNaN(maxDays) || maxDays <= 0) {
    return { valid: false, error: 'Invalid MAX_CLAIM_DAYS rule configuration.' }
  }

  const diffMs = toDate.getTime() - fromDate.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1

  if (diffDays > maxDays) {
    return {
      valid: false,
      error: `Claim range exceeds maximum of ${maxDays} days.`,
    }
  }

  if (diffDays < 1) {
    return { valid: false, error: 'End date must be on or after start date.' }
  }

  return { valid: true }
}

export function checkFutureDate(
  date: Date,
  rules: ValidationRuleMap
): { valid: boolean; error?: string } {
  const allowed = getRuleValue(rules, RULE_CODES.FUTURE_DATE_ALLOWED)
  if (allowed === 'true') return { valid: true }

  const today = new Date()
  today.setHours(23, 59, 59, 999)

  if (date > today) {
    return { valid: false, error: 'Future dates are not allowed.' }
  }

  return { valid: true }
}

// ────────────────────────────────────────────────────────────
// Fuel / taxi mutual exclusion
// ────────────────────────────────────────────────────────────

export function checkFuelTaxiExclusion(
  hasFuel: boolean,
  hasTaxi: boolean,
  rules: ValidationRuleMap
): { valid: boolean; error?: string } {
  const exclusive = getRuleValue(rules, RULE_CODES.FUEL_TAXI_MUTUAL_EXCLUSION)
  if (exclusive !== 'true') return { valid: true }

  if (hasFuel && hasTaxi) {
    return {
      valid: false,
      error: 'Fuel and taxi reimbursement cannot be claimed on the same day.',
    }
  }

  return { valid: true }
}

// ────────────────────────────────────────────────────────────
// KM limit validation (reads from vehicle_types table, not rules)
// ────────────────────────────────────────────────────────────

export function checkKmLimit(
  km: number,
  maxKmRoundTrip: number,
  vehicleName: string
): { valid: boolean; error?: string } {
  if (km > maxKmRoundTrip) {
    return {
      valid: false,
      error: `Distance exceeds ${vehicleName} limit of ${maxKmRoundTrip} km round trip.`,
    }
  }

  return { valid: true }
}

// ────────────────────────────────────────────────────────────
// Duplicate claim check
// ────────────────────────────────────────────────────────────

export async function checkDuplicateClaim(
  supabase: SupabaseClient,
  employeeId: string,
  claimDate: string,
  excludeClaimId?: string
): Promise<{ valid: boolean; error?: string }> {
  let query = supabase
    .from('expense_claims')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('claim_date', claimDate)
    .limit(1)

  if (excludeClaimId) {
    query = query.neq('id', excludeClaimId)
  }

  const { data, error } = await query

  if (error) throw new Error(`Duplicate check failed: ${error.message}`)

  if ((data?.length ?? 0) > 0) {
    return {
      valid: false,
      error: `A claim already exists for this employee on ${claimDate}.`,
    }
  }

  return { valid: true }
}

// ────────────────────────────────────────────────────────────
// Status transition validation
// ────────────────────────────────────────────────────────────

export async function validateTransition(
  supabase: SupabaseClient,
  fromStatusId: string,
  toStatusId: string,
  userRoleId: string | null
): Promise<{
  valid: boolean
  error?: string
  transition?: ClaimStatusTransition
}> {
  const transitions = await getClaimStatusTransitions(supabase, fromStatusId)

  const match = transitions.find((t) => t.to_status_id === toStatusId)

  if (!match) {
    return {
      valid: false,
      error: 'This status transition is not allowed.',
    }
  }

  if (match.required_role_id && match.required_role_id !== userRoleId) {
    return {
      valid: false,
      error: 'You do not have the required role for this transition.',
    }
  }

  return { valid: true, transition: match }
}
