import { describe, expect, it, vi } from 'vitest'

import { getPendingApprovalScopeByActor } from '@/features/approvals/queries/pending-scope'

type QueryResult = {
  data: unknown
  error: { message: string } | null
}

function createSupabaseForPendingScope(results: {
  actorDesignationCode: 'SBH' | 'ZBH'
  level1Ids: string[]
  level2Ids: string[]
  level3Ids: string[]
}) {
  let callIndex = 0

  return {
    from: vi.fn((tableName: string) => {
      if (tableName !== 'employees') {
        throw new Error(`Unexpected table ${tableName}`)
      }

      callIndex += 1

      if (callIndex === 1) {
        const designationResult: QueryResult = {
          data: {
            designation_id: 'designation-id',
            designations: {
              designation_code: results.actorDesignationCode,
            },
          },
          error: null,
        }

        const query = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue(designationResult),
        }

        return query
      }

      const sequence: Array<QueryResult> = [
        {
          data: results.level1Ids.map((id) => ({ id })),
          error: null,
        },
        {
          data: results.level2Ids.map((id) => ({ id })),
          error: null,
        },
        {
          data: results.level3Ids.map((id) => ({ id })),
          error: null,
        },
      ]

      const queryResult = sequence[callIndex - 2] ?? {
        data: [],
        error: null,
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue(queryResult),
      }
    }),
  }
}

describe('getPendingApprovalScopeByActor', () => {
  it('adds level-2 assigned employees as level-1 view-only scope for ZBH', async () => {
    const supabase = createSupabaseForPendingScope({
      actorDesignationCode: 'ZBH',
      level1Ids: ['emp-l1'],
      level2Ids: ['emp-z-1', 'emp-z-2'],
      level3Ids: ['emp-l3'],
    })

    const scope = await getPendingApprovalScopeByActor(
      supabase as never,
      'actor-id'
    )

    expect(scope.level1ActionEmployeeIds).toEqual(['emp-l1'])
    expect(scope.level2ActionEmployeeIds).toEqual(['emp-l3'])
    expect(scope.level1ViewOnlyEmployeeIds).toEqual(['emp-z-1', 'emp-z-2'])
  })

  it('does not add level-2 assigned employees to view-only scope for non-ZBH actors', async () => {
    const supabase = createSupabaseForPendingScope({
      actorDesignationCode: 'SBH',
      level1Ids: ['emp-l1'],
      level2Ids: ['emp-z-1'],
      level3Ids: ['emp-l3'],
    })

    const scope = await getPendingApprovalScopeByActor(
      supabase as never,
      'actor-id'
    )

    expect(scope.level1ActionEmployeeIds).toEqual(['emp-l1'])
    expect(scope.level2ActionEmployeeIds).toEqual(['emp-l3'])
    expect(scope.level1ViewOnlyEmployeeIds).toEqual([])
  })
})
