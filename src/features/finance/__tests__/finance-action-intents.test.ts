import { describe, expect, it } from 'vitest'

import type { ClaimAvailableAction } from '@/features/claims/types'
import {
  buildFinanceActionIntents,
  getFinanceActionToneClass,
  getFinanceSuccessLabel,
  sortFinanceActionIntents,
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

  it('clamps success label count to one when processed count is zero', () => {
    const defaultIntent = buildFinanceActionIntents(FINANCE_APPROVE_ACTION)[0]

    expect(getFinanceSuccessLabel(defaultIntent, 0)).toBe(
      'Approve completed successfully.'
    )
  })

  it('supports allow-resubmit intent when queue action enables it', () => {
    const allowIntent = buildFinanceActionIntents(REJECT_ACTION)[1]

    expect(
      supportsFinanceIntent(
        {
          availableActions: [REJECT_ACTION],
        },
        allowIntent
      )
    ).toBe(true)
  })

  it('falls back to neutral tone for unknown finance action code', () => {
    const toneClass = getFinanceActionToneClass({
      key: 'manual_review:default',
      actionCode: 'manual_review',
      label: 'Manual Review',
      allowResubmit: false,
    })

    expect(toneClass).toBe('bg-sky-600 hover:bg-sky-700')
  })

  it('returns expected tone classes for release/reject intent variants', () => {
    expect(
      getFinanceActionToneClass({
        key: 'payment_released:default',
        actionCode: 'payment_released',
        label: 'Release Payment',
        allowResubmit: false,
      })
    ).toBe('bg-emerald-600 hover:bg-emerald-700')

    expect(
      getFinanceActionToneClass({
        key: 'finance_rejected:default',
        actionCode: 'finance_rejected',
        label: 'Reject',
        allowResubmit: false,
      })
    ).toBe('bg-rose-600 hover:bg-rose-700')

    expect(
      getFinanceActionToneClass({
        key: 'finance_rejected:allow_resubmit',
        actionCode: 'finance_rejected',
        label: 'Reject & Allow Reclaim',
        allowResubmit: true,
      })
    ).toBe('bg-amber-600 hover:bg-amber-700')
  })

  it('uses label ordering as tie-breaker when sort ranks are equal', () => {
    const sorted = sortFinanceActionIntents([
      {
        key: 'manual_review:z',
        actionCode: 'manual_review',
        label: 'Zeta',
        allowResubmit: false,
      },
      {
        key: 'manual_review:a',
        actionCode: 'manual_review',
        label: 'Alpha',
        allowResubmit: false,
      },
    ])

    expect(sorted.map((intent) => intent.label)).toEqual(['Alpha', 'Zeta'])
  })
})
