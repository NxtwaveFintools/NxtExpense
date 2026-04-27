import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function readMigration(fileName: string): string {
  return readFileSync(
    resolve(process.cwd(), 'supabase', 'migrations', fileName),
    'utf8'
  )
}

describe('supabase workflow contract regressions', () => {
  it('keeps reclaim architecture safeguards for superseded claims and one-active-claim uniqueness', () => {
    const migration = readMigration(
      '20260403143000_add_is_superseded_reclaim_architecture.sql'
    )

    expect(migration).toMatch(/expense_claims_one_active_per_employee_date/i)
    expect(migration).toMatch(/where\s*\(not is_superseded\)/i)
    expect(migration).toMatch(
      /create or replace function\s+public\.supersede_rejected_claim/i
    )
    expect(migration).toMatch(/you can only supersede your own claims\./i)
    expect(migration).toMatch(/if not v_claim\.allow_resubmit then/i)
  })

  it('keeps approval and finance RPC signatures transition-driven with allow_resubmit flag', () => {
    const approvalMigration = readMigration(
      '20260318123000_make_workflow_action_resolution_db_driven.sql'
    )
    const financeMigration = readMigration(
      '20260318123030_make_finance_actions_transition_driven.sql'
    )

    expect(approvalMigration).toMatch(
      /create or replace function\s+public\.submit_approval_action_atomic\s*\(/i
    )
    expect(approvalMigration).toMatch(/p_allow_resubmit\s+boolean/i)

    expect(financeMigration).toMatch(
      /create or replace function\s+public\.submit_finance_action_atomic\s*\(/i
    )
    expect(financeMigration).toMatch(/p_allow_resubmit\s+boolean/i)
    expect(financeMigration).toMatch(
      /create or replace function\s+public\.bulk_finance_actions_atomic\s*\(/i
    )
    expect(financeMigration).toMatch(
      /from\s+public\.submit_finance_action_atomic\s*\(/i
    )
  })

  it('keeps admin employee replacement RPC contract available for two-step create/finalize flow', () => {
    const adminCreateMigration = readMigration(
      '20260323143100_enforce_admin_create_employee_approver_rules.sql'
    )
    const replacementMigration = readMigration(
      '20260323195500_add_employee_replacement_flow.sql'
    )

    expect(adminCreateMigration).toMatch(
      /create or replace function\s+public\.admin_create_employee_atomic\s*\(/i
    )
    expect(replacementMigration).toMatch(
      /create or replace function\s+public\.admin_finalize_employee_replacement_atomic\s*\(/i
    )
    expect(replacementMigration).toMatch(/p_old_employee_id\s+uuid/i)
    expect(replacementMigration).toMatch(/p_new_employee_id\s+uuid/i)
  })

  it('keeps the SBH handover migration promoting Hari and preserving Sreejish as inactive', () => {
    const migration = readMigration(
      '20260425103000_handover_sreejish_to_hari_sbh.sql'
    )

    expect(migration).toMatch(/sreejish\.mohanakumar@nxtwave\.co\.in/i)
    expect(migration).toMatch(/hari\.haran@nxtwave\.co\.in/i)
    expect(migration).toMatch(/mansoor@nxtwave\.co\.in/i)
    expect(migration).toMatch(/expenseadmin@nxtwave\.co\.in/i)
    expect(migration).toMatch(/designation_code = 'SBH'/i)
    expect(migration).toMatch(/approval_employee_id_level_1 = null/i)
    expect(migration).toMatch(
      /approval_employee_id_level_3 = v_pm_employee\.id/i
    )
    expect(migration).toMatch(
      /approval_employee_id_level_1 = v_new_employee\.id/i
    )
    expect(migration).toMatch(/role_code = 'APPROVER_L2'/i)
    expect(migration).toMatch(/insert into public\.employee_replacements/i)
    expect(migration).toMatch(/employee_status_id = v_inactive_status_id/i)
    expect(migration).toMatch(/source_admin_log_id/i)
    expect(migration).toMatch(/previous hari designation/i)
    expect(migration).toMatch(/previous hari l3 approver/i)
    expect(migration).toMatch(/insert into public\.config_versions/i)
  })

  it('keeps admin approver options multi-state aware and active-only', () => {
    const migration = readMigration(
      '20260425103100_expand_admin_approver_options_multi_state.sql'
    )

    expect(migration).toMatch(
      /create or replace function\s+public\.get_admin_approver_options_by_state/i
    )
    expect(migration).toMatch(/employee_statuses\s+est/i)
    expect(migration).toMatch(/est\.status_code = 'ACTIVE'/i)
    expect(migration).toMatch(
      /exists\s*\(\s*select 1\s*from public\.employee_states/i
    )
    expect(migration).toMatch(/notify pgrst, 'reload schema'/i)
  })

  it('keeps approval history visibility inheriting predecessor approver scope through employee replacements', () => {
    const migration = readMigration(
      '20260425104500_inherit_replaced_approver_history_visibility.sql'
    )

    expect(migration).toMatch(
      /create or replace function\s+public\.get_my_approver_acted_claim_ids/i
    )
    expect(migration).toMatch(/with recursive/i)
    expect(migration).toMatch(/public\.employee_replacements/i)
    expect(migration).toMatch(
      /er\.new_employee_id = scope\.approver_employee_id/i
    )
    expect(migration).toMatch(/ah\.approver_employee_id/i)
    expect(migration).toMatch(/designation_code = 'ZBH'/i)
    expect(migration).toMatch(/notify pgrst, 'reload schema'/i)
  })

  it('keeps the Odisha/West Bengal SBH handover migration promoting Sambit and preserving Anshuman as inactive', () => {
    const migration = readMigration(
      '20260425112000_handover_anshuman_to_sambit_sbh.sql'
    )

    expect(migration).toMatch(/anshuman\.chatterjee@nxtwave\.co\.in/i)
    expect(migration).toMatch(/sambitkumar\.aich@nxtwave\.co\.in/i)
    expect(migration).toMatch(/mansoor@nxtwave\.co\.in/i)
    expect(migration).toMatch(/expenseadmin@nxtwave\.co\.in/i)
    expect(migration).toMatch(/odisha/i)
    expect(migration).toMatch(/west bengal/i)
    expect(migration).toMatch(/designation_code = 'SBH'/i)
    expect(migration).toMatch(/approval_employee_id_level_1 = null/i)
    expect(migration).toMatch(
      /approval_employee_id_level_3 = v_pm_employee\.id/i
    )
    expect(migration).toMatch(
      /approval_employee_id_level_1 = v_new_employee\.id/i
    )
    expect(migration).toMatch(/insert into public\.employee_replacements/i)
    expect(migration).toMatch(/employee_status_id = v_inactive_status_id/i)
    expect(migration).toMatch(/previous sambit designation/i)
    expect(migration).toMatch(/previous sambit l3 approver/i)
    expect(migration).toMatch(/insert into public\.config_versions/i)
  })

  it('keeps approval history analytics aligned with inherited visibility and shared filters', () => {
    const migration = readMigration(
      '20260425123000_add_approval_history_analytics_rpc.sql'
    )

    expect(migration).toMatch(
      /create or replace function\s+public\.get_approval_history_analytics/i
    )
    expect(migration).toMatch(/public\.get_my_approver_acted_claim_ids/i)
    expect(migration).toMatch(/p_hod_approved_from\s+timestamptz/i)
    expect(migration).toMatch(/p_finance_approved_from\s+timestamptz/i)
    expect(migration).toMatch(/payment_issued_count/i)
    expect(migration).toMatch(/rejected_count/i)
    expect(migration).toMatch(/notify pgrst, 'reload schema'/i)
  })
})
