type WorkflowActionLabelSource = {
  action: string
  display_label: string
}

const WORKFLOW_ACTION_CTA_LABELS: Record<string, string> = {
  approved: 'Approve',
  rejected: 'Reject',
  finance_rejected: 'Reject',
  issued: 'Issue',
  finance_issued: 'Issue',
  reopened: 'Reopen',
  resubmit: 'Resubmit',
  submitted: 'Submit',
}

function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ')
}

function toTitleCaseWords(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}

export function getWorkflowActionCtaLabel(
  action: WorkflowActionLabelSource
): string {
  const mappedLabel = WORKFLOW_ACTION_CTA_LABELS[action.action]
  if (mappedLabel) {
    return mappedLabel
  }

  const normalizedDisplayLabel = normalizeLabel(action.display_label)
  if (normalizedDisplayLabel.length > 0) {
    return normalizedDisplayLabel
  }

  return toTitleCaseWords(action.action)
}

export function getWorkflowActionAllowReclaimLabel(
  action: WorkflowActionLabelSource
): string {
  return `${getWorkflowActionCtaLabel(action)} & Allow Reclaim`
}
