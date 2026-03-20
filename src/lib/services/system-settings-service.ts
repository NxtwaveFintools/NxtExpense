import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_NOTES_LENGTH_KEY = 'MAX_NOTES_LENGTH'
const DEFAULT_MAX_NOTES_LENGTH = 500

type SystemSettingRow = {
  setting_value: unknown
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function parseSettingNumber(settingValue: unknown): number | null {
  const direct = coerceNumber(settingValue)
  if (direct !== null) {
    return direct
  }

  if (
    settingValue &&
    typeof settingValue === 'object' &&
    'value' in (settingValue as Record<string, unknown>)
  ) {
    return coerceNumber((settingValue as Record<string, unknown>).value)
  }

  return null
}

export async function getMaxNotesLength(
  supabase: SupabaseClient
): Promise<number> {
  let data: SystemSettingRow | null = null
  let error: unknown = null

  try {
    const queryResult = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', MAX_NOTES_LENGTH_KEY)
      .eq('is_active', true)
      .maybeSingle()

    data = queryResult.data as SystemSettingRow | null
    error = queryResult.error
  } catch {
    return DEFAULT_MAX_NOTES_LENGTH
  }

  if (error || !data) {
    return DEFAULT_MAX_NOTES_LENGTH
  }

  const parsed = parseSettingNumber((data as SystemSettingRow).setting_value)

  if (parsed === null || parsed <= 0) {
    return DEFAULT_MAX_NOTES_LENGTH
  }

  return parsed
}

export function getMaxTextLengthValidationError(
  value: string | null | undefined,
  maxLength: number,
  fieldLabel: string
): string | null {
  if (!value) {
    return null
  }

  if (value.length <= maxLength) {
    return null
  }

  return `${fieldLabel} cannot exceed ${maxLength} characters.`
}
