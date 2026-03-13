import { createSupabaseServerClient } from '@/lib/supabase/server'
import { DesignationTable } from '@/features/admin/components/designation-table'

export default async function AdminDesignationsPage() {
  const supabase = await createSupabaseServerClient()

  const { data: designations, error } = await supabase
    .from('designations')
    .select(
      'id, designation_code, designation_name, designation_abbreviation, hierarchy_level, is_active'
    )
    .order('hierarchy_level')

  if (error) throw new Error(error.message)

  const activeCount = (designations ?? []).filter((d) => d.is_active).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Designations</h2>
        <span className="text-sm text-foreground/50">
          {activeCount} active / {(designations ?? []).length} total
        </span>
      </div>

      <DesignationTable designations={designations ?? []} />
    </div>
  )
}
