import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ApproverRulesTable } from '@/features/admin/components/approver-rules-table'

export default async function AdminApproverRulesPage() {
  const supabase = await createSupabaseServerClient()

  const [designationsResult, rulesResult] = await Promise.all([
    supabase
      .from('designations')
      .select('id, designation_name')
      .eq('is_active', true)
      .order('hierarchy_level'),
    supabase
      .from('approver_selection_rules')
      .select(
        'id, approval_level, designation_id, requires_same_state, is_active, designations!designation_id(designation_name)'
      )
      .order('approval_level', { ascending: true }),
  ])

  const queryError = designationsResult.error ?? rulesResult.error

  if (queryError) {
    throw new Error(queryError.message)
  }

  const rules = (rulesResult.data ?? []).map((row) => {
    const designation = row.designations as
      | { designation_name: string }
      | Array<{ designation_name: string }>
      | null

    const resolvedDesignation = Array.isArray(designation)
      ? designation[0]
      : designation

    return {
      id: row.id,
      approval_level: row.approval_level,
      designation_id: row.designation_id,
      designation_name: resolvedDesignation?.designation_name ?? 'Unknown',
      requires_same_state: row.requires_same_state,
      is_active: row.is_active,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Approver Rules
        </h2>
        <p className="text-sm text-foreground/60">
          Configure level-wise approver designations for employee onboarding.
        </p>
      </div>

      <ApproverRulesTable
        rules={rules}
        designations={designationsResult.data ?? []}
      />
    </div>
  )
}
