import type { SupabaseClient } from '@supabase/supabase-js'

import { expandMappedExpenseItemTypesForExport } from '@/features/finance/utils/export-item-type-mapping'

type MappedClaimItemRow = {
  claim_id: string
  item_type: string
  amount: number
}

// PostgREST db-max-rows for this project — live-verified 1000 on dev/prod
// (see EXPORT_CHUNK_SIZE's comment in run-csv-export.ts); reused here, not
// re-derived (db-max-rows is a PostgREST server setting, not visible to a
// direct Postgres/SQL connection).
const RPC_ROW_CAP = 1000

// Live-measured 2026-07-03: expense_claim_items has 17,972 claims with
// items; the observed worst case is 5 rows for a single claim_id
// (distribution 1:119, 2:5163, 3:4592, 4:4598, 5:3500 claims; no claim
// exceeds 5). That's today's business/domain shape of a claim, not a DB
// constraint (no CHECK/UNIQUE bounds it) — if claims start carrying more
// item rows, this batch size must be revisited then. RPC_ROW_CAP is the
// actual hard limit; the runtime guard in fetchClaimItemsBatch is what fails
// loudly if this assumption is ever wrong, not this constant by itself.
//
// 180 claims x 5 rows/claim (worst case) = 900 rows, under the 1000-row cap
// with a 100-row margin. Chosen over the raw floor(1000/5)=200 quotient to
// keep a margin below the cap (same convention as
// ENRICHMENT_EXPORT_CHUNK_SIZE in run-csv-export.ts) while keeping RPC
// round-trips low: an 800-claim export page needs at most 5 sequential
// batches at this size, vs. 20 at a more conservative (4x-margin) size.
const CLAIM_ID_BATCH_SIZE = 180

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function toNormalizedAmount(value: number | string): number {
  const numericValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

async function fetchClaimItemsBatch(
  supabase: SupabaseClient,
  claimIds: string[],
  itemTypes: string[]
): Promise<MappedClaimItemRow[]> {
  const { data, error } = await supabase.rpc(
    'get_expense_claim_items_by_claim_ids',
    { p_claim_ids: claimIds, p_item_types: itemTypes }
  )

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as Array<{
    claim_id: string
    item_type: string
    amount: number | string
  }>

  if (rows.length >= RPC_ROW_CAP) {
    throw new Error(
      `get_expense_claim_items_by_claim_ids returned ${rows.length} rows for a batch of ${claimIds.length} claim ids, at or above the PostgREST row cap (${RPC_ROW_CAP}). Results may be truncated — investigate outlier claims or lower CLAIM_ID_BATCH_SIZE in mapped-claim-items.repository.ts.`
    )
  }

  return rows.map((row) => ({
    claim_id: row.claim_id,
    item_type: row.item_type,
    amount: toNormalizedAmount(row.amount),
  }))
}

export async function getMappedClaimItemsByClaimId(
  supabase: SupabaseClient,
  claimIds: string[],
  mappedExpenseItemTypes: string[]
): Promise<Map<string, MappedClaimItemRow[]>> {
  if (claimIds.length === 0 || mappedExpenseItemTypes.length === 0) {
    return new Map<string, MappedClaimItemRow[]>()
  }

  const expandedMappedItemTypes = expandMappedExpenseItemTypesForExport(
    mappedExpenseItemTypes
  )

  const claimItemsByClaimId = new Map<string, MappedClaimItemRow[]>()

  for (const batch of chunk(claimIds, CLAIM_ID_BATCH_SIZE)) {
    const rows = await fetchClaimItemsBatch(
      supabase,
      batch,
      expandedMappedItemTypes
    )

    for (const item of rows) {
      const currentRows = claimItemsByClaimId.get(item.claim_id)

      if (currentRows) {
        currentRows.push(item)
        continue
      }

      claimItemsByClaimId.set(item.claim_id, [item])
    }
  }

  return claimItemsByClaimId
}
