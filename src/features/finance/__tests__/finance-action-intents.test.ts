import { describe, expect, it } from 'vitest'

import type { ClaimAvailableAction } from '@/features/claims/types'
import {
  buildFinanceActionIntents,
  getFinanceSuccessLabel,
  supportsFinanceIntent,
} from '@/features/finance/utils/action-intents'

const ISSUE_ACTION: ClaimAvailableAction = {
  action: 'issued',
  display_label: 'Issue Payment',
  require_notes: false,
  supports_allow_resubmit: false,
  actor_scope: 'finance',
}

const REJECT_ACTION: ClaimAvailableAction = {
  action: 'finance_rejected',
  display_label: 'Reject',
  require_notes: true,
  supports_allow_resubmit: true,
  actor_scope: 'finance',
}

describe('finance action intents', () => {
  it('builds default intent for actions without allow-resubmit support', () => {
    const intents = buildFinanceActionIntents(ISSUE_ACTION)

    expect(intents).toHaveLength(1)
    expect(intents[0]).toEqual({
      key: 'issued:default',
      actionCode: 'issued',
      label: 'Issue',
      allowResubmit: false,
    })
  })

  it('builds default and allow-resubmit intents when action supports it', () => {
    const intents = buildFinanceActionIntents(REJECT_ACTION)

    expect(intents).toHaveLength(2)
    expect(intents[0]).toEqual({
      key: 'finance_rejected:default',
      actionCode: 'finance_rejected',
      label: 'Reject',
      allowResubmit: false,
    })
    expect(intents[1]).toEqual({
      key: 'finance_rejected:allow_resubmit',
      actionCode: 'finance_rejected',
      label: 'Reject & Allow Reclaim',
      allowResubmit: true,
    })
  })

  it('supports matching default intent on a queue item', () => {
    const intents = buildFinanceActionIntents(ISSUE_ACTION)

    expect(
      supportsFinanceIntent(
        {
          availableActions: [ISSUE_ACTION],
        },
        intents[0]
      )
    ).toBe(true)
  })

  it('rejects allow-resubmit intent when item action does not support it', () => {
    const allowResubmitIntent = {
      key: 'issued:allow_resubmit',
      actionCode: 'issued',
      label: 'Issue (Allow Reclaim)',
      allowResubmit: true,
    }

    expect(
      supportsFinanceIntent(
        {
          availableActions: [ISSUE_ACTION],
        },
        allowResubmitIntent
      )
    ).toBe(false)
  })

  it('formats singular and plural success labels', () => {
    const defaultIntent = buildFinanceActionIntents(ISSUE_ACTION)[0]

    expect(getFinanceSuccessLabel(defaultIntent, 1)).toBe(
      'Issue completed successfully.'
    )
    expect(getFinanceSuccessLabel(defaultIntent, 3)).toBe(
      'Issue completed for 3 claims.'
    )
  })
})
