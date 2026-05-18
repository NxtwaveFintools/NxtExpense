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
import pg from 'pg'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseDbUrl = process.env.SUPABASE_DB_URL

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.'
  )
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const KNOWN_AUTH_USER_IDS = new Map([
  ['yohan.mutluri@nxtwave.co.in', 'b088702a-6dd8-451a-8b40-13ca4b9b39bb'],
  ['akshay.e@nxtwave.co.in', '6fa11099-0d97-47aa-90d7-261c20319112'],
  ['bhargavraj.gv@nxtwave.co.in', '476e454b-d578-4676-b534-dc409268bb0a'],
  ['hari.haran@nxtwave.co.in', '54061858-4b56-4ab2-b777-725440385564'],
  ['nagaraju.madugula@nxtwave.co.in', 'fcf9ceb4-5431-417f-abe3-e57c55f3746d'],
  ['vignesh.shenoy@nxtwave.co.in', 'bb8a1e7e-feab-47a2-8656-a11dff76bdf5'],
  ['satyapriya.dash@nxtwave.co.in', 'db2fe915-0b67-4017-b8d9-ff4de2263385'],
  ['mansoor@nxtwave.co.in', 'd85a5655-b0c3-485c-8c22-aa3cef1f7d03'],
  ['sreejish.mohanakumar@nxtwave.co.in', '12e7aa3f-9aa3-4993-a9f1-cb4379593610'],
  ['harisanthosh.tibirisetty@nxtwave.co.in', 'dcba4c41-8f96-4c6b-9a4d-20c0b3226011'],
  ['finance1@nxtwave.co.in', '1663b810-ddcd-4043-97a5-4fd73b1114c8'],
  ['finance2@nxtwave.co.in', 'fb523841-425c-437f-a5c4-8e7ce2d8459d'],
  ['chennakesava.konda@nxtwave.co.in', '437d117b-9e28-445a-9705-e2367acdad0b'],
])

let dbClient = null

async function getDbClient() {
  if (!supabaseDbUrl) {
    return null
  }

  if (dbClient) {
    return dbClient
  }

  dbClient = new pg.Client({
    connectionString: supabaseDbUrl,
    ssl: { rejectUnauthorized: false },
  })

  await dbClient.connect()
  return dbClient
}

async function findAuthUserIdByEmail(email) {
  const normalizedEmail = email.toLowerCase()
  const client = await getDbClient()

  if (client) {
    const { rows } = await client.query(
      `
        select id
        from auth.users
        where lower(email) = lower($1)
          and deleted_at is null
        order by created_at desc
        limit 1
      `,
      [normalizedEmail]
    )

    if (rows[0]?.id) {
      return rows[0].id
    }
  }

  if (KNOWN_AUTH_USER_IDS.has(normalizedEmail)) {
    return KNOWN_AUTH_USER_IDS.get(normalizedEmail) ?? null
  }

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    })

    if (error) {
      break
    }

    const users = Array.isArray(data?.users) ? data.users : []
    const matchedUser =
      users.find((user) => (user.email ?? '').toLowerCase() === normalizedEmail) ??
      null

    if (matchedUser?.id) {
      return matchedUser.id
    }

    if (users.length === 0) {
      break
    }
  }

  return null
}

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
  { email: 'chennakesava.konda@nxtwave.co.in', label: 'Finance User 2 (Live)' },

  // Approvers needed for testing approval flows
  { email: 'sreejish.mohanakumar@nxtwave.co.in',       label: 'SBH  | TN+Kerala   | Sreejish Mohana Kumar (legacy account)' },
  { email: 'harisanthosh.tibirisetty@nxtwave.co.in',   label: 'ZBH  | KA+MH       | Hari Santhosh Tibirisetty (L2 approver for Vignesh, Bhargav)' },
]

async function upsertTestUser(email) {
  const { data, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { email_verified: true },
  })
  if (!createError) {
    return { email, id: data.user.id, mode: 'created' }
  }

  const errorMessage = createError.message ?? ''
  const alreadyExists = /already\s+been\s+registered|already\s+registered|duplicate/i.test(
    errorMessage
  )

  const retriableAuthLookupError = /database error checking email|database error finding users/i.test(
    errorMessage
  )

  if (!alreadyExists && !retriableAuthLookupError) {
    throw new Error(`Create failed for ${email}: ${createError.message}`)
  }

  const existingUserId = await findAuthUserIdByEmail(email)

  if (!existingUserId) {
    throw new Error(
      `User ${email} appears to exist but could not be found in auth.users.`
    )
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(
    existingUserId,
    {
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { email_verified: true },
    }
  )

  if (updateError) throw new Error(`Update failed for ${email}: ${updateError.message}`)

  return { email, id: existingUserId, mode: 'updated' }
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

  if (dbClient) {
    await dbClient.end()
    dbClient = null
  }
}

await main()
