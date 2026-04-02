import { describe, expect, it } from 'vitest'

import type { ClaimAvailableAction } from '@/features/claims/types'
import {
  buildFinanceActionIntents,
  sortFinanceActionIntents,
  getFinanceSuccessLabel,
  supportsFinanceIntent,
} from '@/features/finance/utils/action-intents'

const FINANCE_APPROVE_ACTION: ClaimAvailableAction = {
  action: 'finance_approved',
  display_label: 'Finance Approved',
  require_notes: false,
  supports_allow_resubmit: false,
  actor_scope: 'finance',
}

const RELEASE_ACTION: ClaimAvailableAction = {
  action: 'payment_released',
  display_label: 'Payment Released',
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
    const intents = buildFinanceActionIntents(FINANCE_APPROVE_ACTION)

    expect(intents).toHaveLength(1)
    expect(intents[0]).toEqual({
      key: 'finance_approved:default',
      actionCode: 'finance_approved',
      label: 'Approve',
      allowResubmit: false,
    })
  })

  it('orders intents as release, approve, reject, then reject and allow reclaim', () => {
    const combined = sortFinanceActionIntents([
      ...buildFinanceActionIntents(REJECT_ACTION),
      ...buildFinanceActionIntents(FINANCE_APPROVE_ACTION),
      ...buildFinanceActionIntents(RELEASE_ACTION),
    ])

    expect(combined.map((intent) => intent.label)).toEqual([
      'Release Payment',
      'Approve',
      'Reject',
      'Reject & Allow Reclaim',
    ])
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
    const intents = buildFinanceActionIntents(FINANCE_APPROVE_ACTION)

    expect(
      supportsFinanceIntent(
        {
          availableActions: [FINANCE_APPROVE_ACTION],
        },
        intents[0]
      )
    ).toBe(true)
  })

  it('rejects allow-resubmit intent when item action does not support it', () => {
    const allowResubmitIntent = {
      key: 'finance_approved:allow_resubmit',
      actionCode: 'finance_approved',
      label: 'Issue (Allow Reclaim)',
      allowResubmit: true,
    }

    expect(
      supportsFinanceIntent(
        {
          availableActions: [FINANCE_APPROVE_ACTION],
        },
        allowResubmitIntent
      )
    ).toBe(false)
  })

  it('formats singular and plural success labels', () => {
    const defaultIntent = buildFinanceActionIntents(FINANCE_APPROVE_ACTION)[0]

    expect(getFinanceSuccessLabel(defaultIntent, 1)).toBe(
      'Approve completed successfully.'
    )
    expect(getFinanceSuccessLabel(defaultIntent, 3)).toBe(
      'Approve completed for 3 claims.'
    )
  })
})
