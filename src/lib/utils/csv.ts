const CSV_FORMULA_PREFIX = /^[=+\-@]/
const CSV_CONTROL_PREFIX = /^[\t\r]/
// A bare decimal literal (e.g. "-350", "-350.25") cannot be a formula, so the
// apostrophe guard below would only force spreadsheets to import amounts as
// text. Deliberately strict: no exponents, no separators, no whitespace, so
// payloads like "-350+cmd|' /C calc'!A0" still fall through to sanitization.
const CSV_PLAIN_NUMBER = /^-?\d+(\.\d+)?$/

export function sanitizeCsvValue(value: string): string {
  if (CSV_PLAIN_NUMBER.test(value)) {
    return value
  }

  if (CSV_FORMULA_PREFIX.test(value) || CSV_CONTROL_PREFIX.test(value)) {
    // Prefix with apostrophe so spreadsheet apps treat content as plain text.
    return `'${value}`
  }

  return value
}

export function toCsvCell(value: string): string {
  const escaped = sanitizeCsvValue(value).replaceAll('"', '""')
  return `"${escaped}"`
}
