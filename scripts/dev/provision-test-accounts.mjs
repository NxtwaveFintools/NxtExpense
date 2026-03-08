/**
 * Dev-only script: Provisions all test accounts with email+password auth.
 * These are real employee emails that exist in the DB — we create/update
 * their auth.users entries so they can log in via password during testing
 * (since Microsoft SSO is unavailable for these accounts locally).
 *
 * Default password: Password@123
 * Run: node --env-file=.env.local scripts/dev/provision-test-accounts.mjs
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.'
  )
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEFAULT_PASSWORD = 'Password@123'

const TEST_ACCOUNTS = [
  // Group 1 — Standard Flow (SRO / BOA / ABH → SBH → Mansoor → Finance)
  { email: 'yohan.mutluri@nxtwave.co.in',   label: 'SRO  | AP       | Yohan Mutluri' },
  { email: 'akshay.e@nxtwave.co.in',         label: 'SRO  | Kerala   | Akshay E' },
  { email: 'bhargavraj.gv@nxtwave.co.in',    label: 'BOA  | Karnataka| Bhargav Raj Gv' },
  { email: 'hari.haran@nxtwave.co.in',       label: 'ABH  | Tamil Nadu| Hari Haran S' },

  // Group 2 — Direct to Mansoor (SBH / ZBH / PM)
  { email: 'nagaraju.madugula@nxtwave.co.in',label: 'SBH  | AP       | Madugula Nagaraju' },
  { email: 'vignesh.shenoy@nxtwave.co.in',   label: 'SBH  | Karnataka| Vignesh Shenoy' },
  { email: 'satyapriya.dash@nxtwave.co.in',  label: 'ZBH  | Multi    | Satya Priya Dash' },
  { email: 'mansoor@nxtwave.co.in',          label: 'PM   | All      | Mansoor Valli Gangupalli' },

  // Group 3 — Finance Team
  { email: 'finance1@nxtwave.co.in',         label: 'Finance User 1' },
  { email: 'finance2@nxtwave.co.in',         label: 'Finance User 2' },

  // Approvers needed for testing approval flows
  { email: 'sreejish.mohanakumar@nxtwave.co.in',       label: 'SBH  | TN+Kerala   | Sreejish Mohana Kumar (L1 approver for Akshay, Hari)' },
  { email: 'harisanthosh.tibirisetty@nxtwave.co.in',   label: 'ZBH  | KA+MH       | Hari Santhosh Tibirisetty (L2 approver for Vignesh, Bhargav)' },
]

async function upsertTestUser(email) {
  // List all users and find by email
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })

  if (listError) throw new Error(`Unable to list users: ${listError.message}`)

  const existing = usersData.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  )

  if (existing) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      existing.id,
      { password: DEFAULT_PASSWORD, email_confirm: true }
    )
    if (updateError) throw new Error(`Update failed for ${email}: ${updateError.message}`)
    return { email, id: existing.id, mode: 'updated' }
  }

  const { data, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
  })
  if (createError) throw new Error(`Create failed for ${email}: ${createError.message}`)
  return { email, id: data.user.id, mode: 'created' }
}

async function main() {
  console.log('\n🔧  Provisioning test accounts...\n')
  console.log(`${'Email'.padEnd(45)} ${'Label'.padEnd(40)} Status`)
  console.log('-'.repeat(100))

  for (const account of TEST_ACCOUNTS) {
    try {
      const result = await upsertTestUser(account.email)
      const status = result.mode === 'created' ? '✅ CREATED' : '🔄 UPDATED'
      console.log(`${account.email.padEnd(45)} ${account.label.padEnd(40)} ${status}`)
    } catch (err) {
      console.error(`${account.email.padEnd(45)} ${account.label.padEnd(40)} ❌ ERROR: ${err.message}`)
    }
  }

  console.log('\n✅  Done. All accounts can now log in with:')
  console.log(`   Password: ${DEFAULT_PASSWORD}\n`)
}

await main()
