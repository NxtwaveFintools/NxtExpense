import type { SupabaseClient } from '@supabase/supabase-js'

import type { ParsedClaimStatusFilter } from '@/lib/utils/claim-status-filter'

type NullableBoolean = boolean | null

type ResolverRpcRow = {
  resolve_claim_allow_resubmit_filter?: boolean | null
}

type ClaimStatusResolverRow = {
  allow_resubmit_status_name: string | null
}

function isMissingResolverRpcError(
  error: { message?: string } | null
): boolean {
  const message = error?.message?.toLowerCase() ?? ''

  return (
    message.includes('resolve_claim_allow_resubmit_filter') &&
    (message.includes('schema cache') || message.includes('does not exist'))
  )
}

function toNullableBoolean(value: unknown): NullableBoolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (value === null || value === undefined) {
    return null
  }

  if (Array.isArray(value)) {
    const first = value[0] as ResolverRpcRow | undefined
    const nested = first?.resolve_claim_allow_resubmit_filter
    return typeof nested === 'boolean' ? nested : null
  }

  if (typeof value === 'object') {
    const nested = (value as ResolverRpcRow).resolve_claim_allow_resubmit_filter
    return typeof nested === 'boolean' ? nested : null
  }

  return null
}

async function resolveFromClaimStatusMetadata(
  supabase: SupabaseClient,
  statusId: string
): Promise<NullableBoolean> {
  const { data, error } = await supabase
    .from('claim_statuses')
    .select('allow_resubmit_status_name')
    .eq('id', statusId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const statusRow = (data ?? null) as ClaimStatusResolverRow | null
  const hasReclaimVariant = Boolean(
    statusRow?.allow_resubmit_status_name?.trim()
  )

  return hasReclaimVariant ? false : null
}

export async function resolveClaimAllowResubmitFilterValue(
  supabase: SupabaseClient,
  parsedStatusFilter: ParsedClaimStatusFilter | null
): Promise<NullableBoolean> {
  if (!parsedStatusFilter) {
    return null
  }

  if (parsedStatusFilter.allowResubmitOnly) {
    return true
  }

  const { data, error } = await supabase.rpc(
    'resolve_claim_allow_resubmit_filter',
    {
      p_claim_status_id: parsedStatusFilter.statusId,
      p_claim_allow_resubmit: null,
    }
  )

  if (error) {
    if (!isMissingResolverRpcError(error)) {
      throw new Error(error.message)
    }

    return resolveFromClaimStatusMetadata(supabase, parsedStatusFilter.statusId)
  }

  return toNullableBoolean(data)
}
