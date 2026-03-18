import { describe, expect, it } from 'vitest'

import {
  addApprovalFiltersToParams,
  normalizeApprovalHistoryFilters,
} from '@/features/approvals/utils/history-filters'
import {
  buildCursorNavigationLinks,
  decodeCursorTrail,
  encodeCursorTrail,
} from '@/lib/utils/pagination'

const VALID_STATUS_ID = '3ae9b558-c006-427d-8ce6-13057d438d17'

describe('approvals pagination flow e2e scenario', () => {
  it('preserves active filters while moving next and back through history pages', () => {
    const normalizedFilters = normalizeApprovalHistoryFilters({
      employeeName: 'Rahul',
      claimStatus: VALID_STATUS_ID,
      claimDate: '2026-03-01',
      hodApprovedFrom: '2026-03-01',
      hodApprovedTo: '2026-03-31',
      financeApprovedFrom: '2026-03-02',
      financeApprovedTo: '2026-03-30',
    })

    const initialQuery = Object.fromEntries(
      addApprovalFiltersToParams(
        new URLSearchParams(),
        normalizedFilters
      ).entries()
    )

    const page1 = buildCursorNavigationLinks({
      pathname: '/approvals',
      query: initialQuery,
      cursorKey: 'historyCursor',
      trailKey: 'historyTrail',
      currentCursor: null,
      currentTrail: [],
      nextCursor: 'cursor-page-2',
    })

    expect(page1.pageNumber).toBe(1)
    expect(page1.backHref).toBeNull()
    expect(page1.nextHref).toBeTruthy()

    const page2Params = new URLSearchParams(page1.nextHref?.split('?')[1] ?? '')
    expect(page2Params.get('claimStatus')).toBe(VALID_STATUS_ID)
    expect(page2Params.get('employeeName')).toBe('Rahul')
    expect(page2Params.get('historyCursor')).toBe('cursor-page-2')

    const page2 = buildCursorNavigationLinks({
      pathname: '/approvals',
      query: Object.fromEntries(page2Params.entries()),
      cursorKey: 'historyCursor',
      trailKey: 'historyTrail',
      currentCursor: 'cursor-page-2',
      currentTrail: decodeCursorTrail(page2Params.get('historyTrail')),
      nextCursor: 'cursor-page-3',
    })

    expect(page2.pageNumber).toBe(2)
    expect(page2.backHref).toBeTruthy()
    expect(page2.nextHref).toBeTruthy()

    const page3Params = new URLSearchParams(page2.nextHref?.split('?')[1] ?? '')
    expect(decodeCursorTrail(page3Params.get('historyTrail'))).toEqual([
      null,
      'cursor-page-2',
    ])

    const backToPage1 = new URLSearchParams(page2.backHref?.split('?')[1] ?? '')
    expect(backToPage1.get('historyCursor')).toBeNull()
    expect(backToPage1.get('claimStatus')).toBe(VALID_STATUS_ID)
    expect(backToPage1.get('employeeName')).toBe('Rahul')
  })

  it('keeps explicit non-history query params while paginating history list', () => {
    const links = buildCursorNavigationLinks({
      pathname: '/approvals',
      query: {
        pendingCursor: 'pending-cursor',
        pendingTrail: encodeCursorTrail([null, 'pending-1']),
      },
      cursorKey: 'historyCursor',
      trailKey: 'historyTrail',
      currentCursor: 'history-2',
      currentTrail: [null, 'history-1'],
      nextCursor: 'history-3',
    })

    const nextParams = new URLSearchParams(links.nextHref?.split('?')[1] ?? '')
    expect(nextParams.get('pendingCursor')).toBe('pending-cursor')
    expect(nextParams.get('pendingTrail')).toBeTruthy()
    expect(nextParams.get('historyCursor')).toBe('history-3')
  })
})
