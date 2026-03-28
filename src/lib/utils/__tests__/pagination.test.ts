import { describe, expect, it } from 'vitest'

import {
  buildCursorNavigationLinks,
  decodeCursor,
  decodeCursorTrail,
  encodeCursor,
  encodeCursorTrail,
  getCursorPageStartIndex,
  getCursorTotalPages,
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

  it('throws on valid base64 with invalid cursor payload shape', () => {
    const malformedPayload = Buffer.from(
      JSON.stringify({ created_at: '2026-03-06T08:00:00.000Z' }),
      'utf-8'
    ).toString('base64')

    expect(() => decodeCursor(malformedPayload)).toThrowError('Invalid cursor.')
  })

  it('encodes and decodes cursor trails with null entries', () => {
    const encodedTrail = encodeCursorTrail([null, 'cursor-1', 'cursor-2'])

    expect(decodeCursorTrail(encodedTrail)).toEqual([
      null,
      'cursor-1',
      'cursor-2',
    ])
  })

  it('returns empty cursor trail for invalid payloads', () => {
    expect(decodeCursorTrail(null)).toEqual([])
    expect(decodeCursorTrail(undefined)).toEqual([])
    expect(decodeCursorTrail('not-a-valid-base64')).toEqual([])
  })

  it('normalizes non-string cursor trail entries to null', () => {
    const encodedTrail = Buffer.from(
      JSON.stringify([123, '__NULL_CURSOR__', 'cursor-3']),
      'utf-8'
    ).toString('base64')

    expect(decodeCursorTrail(encodedTrail)).toEqual([null, null, 'cursor-3'])
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

  it('keeps first query value when query param contains multiple values', () => {
    const links = buildCursorNavigationLinks({
      pathname: '/approvals',
      query: {
        actorFilter: ['finance', 'hod'],
      },
      cursorKey: 'historyCursor',
      trailKey: 'historyTrail',
      currentCursor: 'history-1',
      currentTrail: [null],
      nextCursor: null,
    })

    expect(links.nextHref).toBeNull()
    expect(links.backHref).toBe('/approvals?actorFilter=finance')
  })

  it('computes total pages from total items and page size', () => {
    expect(getCursorTotalPages(0, 10)).toBe(1)
    expect(getCursorTotalPages(1, 10)).toBe(1)
    expect(getCursorTotalPages(20, 10)).toBe(2)
    expect(getCursorTotalPages(21, 10)).toBe(3)
  })

  it('computes page start index for row serial numbering', () => {
    expect(getCursorPageStartIndex(1, 10)).toBe(1)
    expect(getCursorPageStartIndex(2, 10)).toBe(11)
    expect(getCursorPageStartIndex(3, 25)).toBe(51)
    expect(getCursorPageStartIndex(0, 10)).toBe(1)
  })
})
