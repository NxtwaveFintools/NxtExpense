import { type NextRequest, NextResponse } from 'next/server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getAllVehicleTypes,
  getVehicleTypesByDesignation,
} from '@/lib/services/config-service'

export const revalidate = 3600

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const designationId = request.nextUrl.searchParams.get('designation_id')

    const data = designationId
      ? await getVehicleTypesByDesignation(supabase, designationId)
      : await getAllVehicleTypes(supabase)

    return NextResponse.json(data)
  } catch (error) {
    console.error('[API] vehicle-types error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vehicle types' },
      { status: 500 }
    )
  }
}
