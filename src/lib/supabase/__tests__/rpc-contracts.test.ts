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
})
