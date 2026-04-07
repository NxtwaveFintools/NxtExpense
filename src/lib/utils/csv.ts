const CSV_FORMULA_PREFIX = /^[=+\-@]/
const CSV_CONTROL_PREFIX = /^[\t\r]/

export function sanitizeCsvValue(value: string): string {
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
