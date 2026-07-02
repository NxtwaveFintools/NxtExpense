import type { SupabaseClient } from '@supabase/supabase-js'

export type ExportPreflightResult =
  | { ok: true; employeeId: string; estimatedTotalRows: number | null }
  | { ok: false; status: number; message: string }

export type ExportPreflightHandler = (
  supabase: SupabaseClient,
  user: { email: string } | null,
  searchParams: URLSearchParams
) => Promise<ExportPreflightResult>
