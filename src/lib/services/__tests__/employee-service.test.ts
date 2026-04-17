import { describe, expect, it, vi } from 'vitest'

import { hasApproverAssignments } from '@/lib/services/employee-service'

type QueryResult = {
  data: unknown
  error: { message: string } | null
}

function createSupabaseForApproverAssignments(results: {
  approverRow: { id: string } | null
  level1Count: number
  level2Count: number
  level3Count: number
}) {
  let callIndex = 0

  return {
    from: vi.fn((tableName: string) => {
      if (tableName !== 'employees') {
        throw new Error(`Unexpected table ${tableName}`)
      }

      callIndex += 1

      if (callIndex === 1) {
        const approverResult: QueryResult = {
          data: results.approverRow,
          error: null,
        }

        const query = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue(approverResult),
        }

        return query
      }

      const assignmentSequence: Array<QueryResult> = [
        {
          data: Array.from({ length: results.level1Count }, (_, index) => ({
            id: `l1-${index}`,
          })),
          error: null,
        },
        {
          data: Array.from({ length: results.level2Count }, (_, index) => ({
            id: `l2-${index}`,
          })),
          error: null,
        },
        {
          data: Array.from({ length: results.level3Count }, (_, index) => ({
            id: `l3-${index}`,
          })),
          error: null,
        },
      ]

      const queryResult = assignmentSequence[callIndex - 2] ?? {
        data: [],
        error: null,
      }

      const query = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(queryResult),
      }

      return query
    }),
  }
}

describe('hasApproverAssignments', () => {
  it('returns true when actor has level-2 assignments (ZBH view scope)', async () => {
    const supabase = createSupabaseForApproverAssignments({
      approverRow: { id: 'actor-id' },
      level1Count: 0,
      level2Count: 1,
      level3Count: 0,
    })

    const hasAssignments = await hasApproverAssignments(
      supabase as never,
      'zbh@nxtwave.co.in'
    )

    expect(hasAssignments).toBe(true)
  })

  it('returns false when actor has no assignments at any level', async () => {
    const supabase = createSupabaseForApproverAssignments({
      approverRow: { id: 'actor-id' },
      level1Count: 0,
      level2Count: 0,
      level3Count: 0,
    })

    const hasAssignments = await hasApproverAssignments(
      supabase as never,
      'employee@nxtwave.co.in'
    )

    expect(hasAssignments).toBe(false)
  })

  it('returns false when approver email is not found', async () => {
    const supabase = createSupabaseForApproverAssignments({
      approverRow: null,
      level1Count: 1,
      level2Count: 1,
      level3Count: 1,
    })

    const hasAssignments = await hasApproverAssignments(
      supabase as never,
      'missing@nxtwave.co.in'
    )

    expect(hasAssignments).toBe(false)
  })
})
