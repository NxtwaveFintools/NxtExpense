import { describe, expect, it, vi } from 'vitest'

import { getApprovalEmployeeNameSuggestions } from '@/features/approvals/queries/employee-name-suggestions'

function createSupabaseMock(result: {
  data?: unknown
  error?: { message?: string } | null
}) {
  const rpc = vi.fn().mockResolvedValue({
    data: result.data ?? null,
    error: result.error ?? null,
  })

  return {
    rpc,
  }
}

describe('getApprovalEmployeeNameSuggestions', () => {
  it('returns trimmed names from RPC rows', async () => {
    const supabase = createSupabaseMock({
      data: [{ employee_name: 'Alex' }, { employee_name: '  Mansoor  ' }],
    })

    const result = await getApprovalEmployeeNameSuggestions(
      supabase as never,
      'man'
    )

    expect(result).toEqual(['Alex', 'Mansoor'])
    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_approval_employee_name_suggestions',
      {
        p_name_search: 'man',
        p_limit: 100,
      }
    )
  })

  it('returns an empty list when suggestion RPC is not yet deployed', async () => {
    const supabase = createSupabaseMock({
      error: {
        message:
          'Could not find the function public.get_approval_employee_name_suggestions(text, integer) in the schema cache',
      },
    })

    const result = await getApprovalEmployeeNameSuggestions(
      supabase as never,
      null
    )

    expect(result).toEqual([])
  })

  it('throws for non-compatibility RPC failures', async () => {
    const supabase = createSupabaseMock({
      error: {
        message:
          'permission denied for function get_approval_employee_name_suggestions',
      },
    })

    await expect(
      getApprovalEmployeeNameSuggestions(supabase as never, 'alex')
    ).rejects.toThrow(
      'permission denied for function get_approval_employee_name_suggestions'
    )
  })
})
