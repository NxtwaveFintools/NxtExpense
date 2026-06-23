const REQUIRED_FINANCE_NOTES_ERROR_MESSAGE =
  'Notes are required for Reject / Reject & Allow Reclaim actions. Please add notes and try again.'

function normalizeFinanceNotes(notes: string | undefined): string {
  return notes?.trim() ?? ''
}

export function getRequiredFinanceNotesError(
  action: { require_notes: boolean } | undefined,
  notes: string | undefined
): string | null {
  if (!action?.require_notes) {
    return null
  }

  if (normalizeFinanceNotes(notes).length > 0) {
    return null
  }

  return REQUIRED_FINANCE_NOTES_ERROR_MESSAGE
}
