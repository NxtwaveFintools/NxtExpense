import { describe, expect, it, vi } from 'vitest'

import { parseClaimStatusFilterValue } from '@/lib/utils/claim-status-filter'
import { resolveClaimAllowResubmitFilterValue } from '@/lib/services/claim-status-filter-service'

const REJECTED_STATUS_ID = '3ae9b558-c006-427d-8ce6-13057d438d17'

function createSupabaseMock(options?: {
  rpcData?: unknown
  rpcError?: { message?: string } | null
  metadataRow?: { allow_resubmit_status_name: string | null } | null
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options?.metadataRow ?? null,
    error: null,
  })
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })

  const rpc = vi.fn().mockResolvedValue({
    data: options?.rpcData ?? null,
    error: options?.rpcError ?? null,
  })

  return {
    rpc,
    from,
  }
}

describe('resolveClaimAllowResubmitFilterValue', () => {
  it('returns null when no status filter is provided', async () => {
    const supabase = createSupabaseMock()

    const result = await resolveClaimAllowResubmitFilterValue(
      supabase as never,
      null
    )

    expect(result).toBeNull()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('returns true for explicit allow_resubmit filter tokens', async () => {
    const supabase = createSupabaseMock()
    const parsed = parseClaimStatusFilterValue(
      `${REJECTED_STATUS_ID}:allow_resubmit`
    )

    const result = await resolveClaimAllowResubmitFilterValue(
      supabase as never,
      parsed
    )

    expect(result).toBe(true)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('uses resolver RPC output for plain status filters', async () => {
    const supabase = createSupabaseMock({ rpcData: false })
    const parsed = parseClaimStatusFilterValue(REJECTED_STATUS_ID)

    const result = await resolveClaimAllowResubmitFilterValue(
      supabase as never,
      parsed
    )

    expect(result).toBe(false)
    expect(supabase.rpc).toHaveBeenCalledWith(
      'resolve_claim_allow_resubmit_filter',
      {
        p_claim_status_id: REJECTED_STATUS_ID,
        p_claim_allow_resubmit: null,
      }
    )
  })

  it('falls back to claim_statuses metadata when resolver RPC is unavailable', async () => {
    const supabase = createSupabaseMock({
      rpcError: {
        message:
          'Could not find the function public.resolve_claim_allow_resubmit_filter(uuid, boolean) in the schema cache',
      },
      metadataRow: {
        allow_resubmit_status_name: 'Rejected - Allow Reclaim',
      },
    })
    const parsed = parseClaimStatusFilterValue(REJECTED_STATUS_ID)

    const result = await resolveClaimAllowResubmitFilterValue(
      supabase as never,
      parsed
    )

    expect(result).toBe(false)
    expect(supabase.from).toHaveBeenCalledWith('claim_statuses')
  })

  it('returns null from metadata fallback when status has no reclaim variant', async () => {
    const supabase = createSupabaseMock({
      rpcError: {
        message:
          'Could not find the function public.resolve_claim_allow_resubmit_filter(uuid, boolean) in the schema cache',
      },
      metadataRow: {
        allow_resubmit_status_name: null,
      },
    })
    const parsed = parseClaimStatusFilterValue(REJECTED_STATUS_ID)

    const result = await resolveClaimAllowResubmitFilterValue(
      supabase as never,
      parsed
    )

    expect(result).toBeNull()
  })
})
