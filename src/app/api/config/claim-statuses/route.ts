import { NextResponse } from 'next/server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAllClaimStatuses } from '@/lib/services/config-service'

export const revalidate = 3600

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const data = await getAllClaimStatuses(supabase)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[API] claim-statuses error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch claim statuses' },
      { status: 500 }
    )
  }
}
