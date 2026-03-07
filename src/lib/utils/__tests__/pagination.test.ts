import { describe, expect, it } from 'vitest'

import {
  buildCursorNavigationLinks,
  decodeCursor,
  decodeCursorTrail,
  encodeCursor,
  encodeCursorTrail,
} from '@/lib/utils/pagination'

describe('pagination cursor utils', () => {
  it('encodes and decodes cursor payload', () => {
    const cursor = encodeCursor({
      created_at: '2026-03-06T08:00:00.000Z',
      id: 'abc-123',
    })

    expect(decodeCursor(cursor)).toEqual({
      created_at: '2026-03-06T08:00:00.000Z',
      id: 'abc-123',
    })
  })

  it('throws on invalid cursor', () => {
    expect(() => decodeCursor('invalid-cursor')).toThrowError('Invalid cursor.')
  })

  it('encodes and decodes cursor trails with null entries', () => {
    const encodedTrail = encodeCursorTrail([null, 'cursor-1', 'cursor-2'])

    expect(decodeCursorTrail(encodedTrail)).toEqual([
      null,
      'cursor-1',
      'cursor-2',
    ])
  })

  it('builds next link and page number for first cursor page', () => {
    const links = buildCursorNavigationLinks({
      pathname: '/approvals',
      query: {
        employeeName: 'john',
        actorFilter: 'finance',
        pendingCursor: 'pending-1',
      },
      cursorKey: 'historyCursor',
      trailKey: 'historyTrail',
      currentCursor: null,
      currentTrail: [],
      nextCursor: 'history-1',
    })

    expect(links.pageNumber).toBe(1)
    expect(links.backHref).toBeNull()
    expect(links.nextHref).toBeTruthy()

    const params = new URLSearchParams(links.nextHref?.split('?')[1] ?? '')
    expect(params.get('historyCursor')).toBe('history-1')
    expect(params.get('employeeName')).toBe('john')
    expect(params.get('actorFilter')).toBe('finance')
    expect(params.get('pendingCursor')).toBe('pending-1')
    expect(decodeCursorTrail(params.get('historyTrail'))).toEqual([null])
  })

  it('builds back and next links correctly for deeper page trails', () => {
    const links = buildCursorNavigationLinks({
      pathname: '/approvals',
      query: {
        actorFilter: 'all',
      },
      cursorKey: 'historyCursor',
      trailKey: 'historyTrail',
      currentCursor: 'history-2',
      currentTrail: [null, 'history-1'],
      nextCursor: 'history-3',
    })

    expect(links.pageNumber).toBe(3)
    expect(links.backHref).toBeTruthy()
    expect(links.nextHref).toBeTruthy()

    const backParams = new URLSearchParams(links.backHref?.split('?')[1] ?? '')
    expect(backParams.get('historyCursor')).toBe('history-1')
    expect(decodeCursorTrail(backParams.get('historyTrail'))).toEqual([null])

    const nextParams = new URLSearchParams(links.nextHref?.split('?')[1] ?? '')
    expect(nextParams.get('historyCursor')).toBe('history-3')
    expect(decodeCursorTrail(nextParams.get('historyTrail'))).toEqual([
      null,
      'history-1',
      'history-2',
    ])
  })
})
