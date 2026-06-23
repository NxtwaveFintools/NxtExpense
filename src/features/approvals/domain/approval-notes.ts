export const REQUIRED_NOTES_ERROR_MESSAGE =
  'Notes are required for Reject / Reject & Allow Reclaim actions. Please add notes and try again.'

function normalizeApprovalNotes(notes: string | undefined): string {
  return notes?.trim() ?? ''
}

export function getRequiredNotesError(
  action: { require_notes: boolean } | undefined,
  notes: string | undefined
): string | null {
  if (!action?.require_notes) {
    return null
  }

  if (normalizeApprovalNotes(notes).length > 0) {
    return null
  }

  return REQUIRED_NOTES_ERROR_MESSAGE
}
