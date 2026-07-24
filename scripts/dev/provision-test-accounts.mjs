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

// Full auth.users id map for every provisioned account. Without SUPABASE_DB_URL
// the script's only other lookup is admin.listUsers pagination, which is
// order-dependent and intermittently misses accounts that already exist without
// a password (SSO-only). Hardcoding the ids makes every re-run deterministic.
// Captured from auth.users on 2026-07-24; re-query if an account is recreated.
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
  ['ravinder.jangili@nxtwave.co.in', '239ec437-20c7-4094-aaa5-ea7e81046df8'],
  ['chandramouli.narina@nxtwave.co.in', '46a36dc1-3db3-473c-9c96-7479393bd8be'],
  ['jijo.varghese@nxtwave.co.in', '3eec3324-9e8d-4d1e-bf43-11ce204443fc'],
  ['ashish.prakashpatil@nxtwave.co.in', 'ed1f260c-87c0-4013-99b2-e13734f2feec'],
  ['bipin.sati@nxtwave.co.in', '0be08c58-2979-49d2-b795-8d21729b7d73'],
  ['nithin.k@nxtwave.co.in', '7464ccc7-28ec-4650-82bd-50fcaff34499'],
  ['siranjeeva.c@nxtwave.co.in', '9f5275a5-6e56-410c-b955-811bf83acb75'],
  ['c.rethinakumar@nxtwave.co.in', '23814fdf-31cc-402b-92f3-fc421bdec2ce'],
  ['nilesh.tiwari@nxtwave.co.in', 'e618116f-767a-4dd9-a99e-8b827a0204cf'],
  ['prathamesh.pawar@nxtwave.co.in', 'd5f6dab1-4205-4eb1-afd7-5151f0477b53'],
  ['sparsh.gupta@nxtwave.co.in', '95888eeb-db74-4ad7-9220-87d5257e6fb7'],
  ['arkaprabha.ghosh@nxtwave.co.in', '5749e1e0-e40e-494b-8705-edfa52144149'],
  ['akshaykumar.pal@nxtwave.co.in', '8a132474-18ab-4853-8fc6-ba65935be7cb'],
  ['adarshanand.digal@nxtwave.co.in', 'fae9780d-f33b-4bb2-86a6-f8510dc5a6fe'],
  ['sambitkumar.aich@nxtwave.co.in', '26206957-90a5-484f-8841-92cc8a858f16'],
  ['indraneel.sanjayingole@nxtwave.co.in', '31ae7067-7f18-43f9-b2b3-91b6cc1e59ba'],
  ['veerabhadraswamy.attili@nxtwave.co.in', 'def5e7ab-6730-4d72-97d4-94d293e33a0e'],
  ['abhay.kumar@nxtwave.co.in', 'f3e3c5a6-c121-46be-aa6a-63670990dc19'],
  ['ashish.patel@nxtwave.co.in', '4a4163b9-16b8-4970-85ff-2c673557235f'],
  ['badalranjan.rout@nxtwave.co.in', '23c9d433-b084-4f08-82de-bea22b288a51'],
  ['kushal.mukherjee@nxtwave.co.in', '1922ead6-c588-47e1-b5c3-ebc46d05bd93'],
  ['muhammed.hijas@nxtwave.co.in', '79782ec5-b71c-4ab4-a709-950449e7df80'],
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

  for (let page = 1; page <= 100; page += 1) {
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

// Per-account password overrides. MUST stay in sync with PASSWORD_OVERRIDES in
// e2e/fixtures/test-accounts.ts — the e2e login helper reads that map, so if the
// provisioned password differs from what the fixture logs in with, that
// account's login fails and every flow that needs it (e.g. Mansoor's HOD
// approval) breaks. Mansoor is the one account that does NOT use the default.
const PASSWORD_OVERRIDES = new Map([
  ['mansoor@nxtwave.co.in', 'hod@Nxtwave'],
])

function resolvePassword(email) {
  return PASSWORD_OVERRIDES.get(email.toLowerCase()) ?? DEFAULT_PASSWORD
}

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
  { email: 'sreejish.mohanakumar@nxtwave.co.in',       label: 'SBH  | Tamil Nadu  | Sreejish Mohana Kumar (TN SBH — reactivated 2026-07)' },
  { email: 'harisanthosh.tibirisetty@nxtwave.co.in',   label: 'ZBH  | KA+MH       | Hari Santhosh Tibirisetty (L2 approver for Vignesh, Bhargav)' },

  // ── Hierarchy changes 2026-07: the 9 new joiners + splits ──────────────────
  // These employees were created by supabase/migrations/20260723*. They log in
  // via Microsoft SSO in production; here we give them password auth so e2e and
  // manual verification can drive their flows. Emails match employees rows.
  //   docs/hierarchy-changes-2026-07-findings.md · -prod-runbook.md
  { email: 'jijo.varghese@nxtwave.co.in',        label: 'SBH  | Kerala      | Jijo Varghese (new KL SBH — L1 for Kerala SROs)' },
  { email: 'ashish.prakashpatil@nxtwave.co.in',  label: 'SBH  | Maharashtra | Ashish Prakash Patil (new MH SBH)' },
  { email: 'bipin.sati@nxtwave.co.in',           label: 'SBH  | Delhi NCR   | Bipin Chandra Sati (new DL SBH)' },
  { email: 'nithin.k@nxtwave.co.in',             label: 'SBH  | Karnataka   | Nithin K (2nd KA SBH — no reports yet)' },
  { email: 'siranjeeva.c@nxtwave.co.in',         label: 'ABH  | Tamil Nadu  | Siranjeeva C (new TN ABH — L1 = Sreejish)' },
  { email: 'c.rethinakumar@nxtwave.co.in',       label: 'ABH  | Tamil Nadu  | Rethina Kumar C (new TN ABH — L1 = Sreejish)' },
  { email: 'nilesh.tiwari@nxtwave.co.in',        label: 'ABH  | Uttar Pradesh| Nilesh Tiwari (new UP ABH — L1 = Akshay)' },
  { email: 'prathamesh.pawar@nxtwave.co.in',     label: 'ABH  | Maharashtra | Prathamesh Pawar (new MH ABH — L1 = Ashish)' },
  { email: 'sparsh.gupta@nxtwave.co.in',         label: 'ABH  | Rajasthan   | Sparsh Gupta (new RJ ABH — L1 = Arka)' },

  // Incoming approvers referenced by the new joiners' chains (may already exist).
  { email: 'arkaprabha.ghosh@nxtwave.co.in',     label: 'SBH  | Rajasthan   | Arka Prabha Ghosh (moved MH -> RJ)' },
  { email: 'akshaykumar.pal@nxtwave.co.in',      label: 'SBH  | Uttar Pradesh| Akshay Kumar Pal (narrowed DL -> UP)' },

  // Demoted SBH -> ABH. The §9.1 regression case: as an ABH his flow is [1,2,3],
  // so he must submit through his L1 approver (Arka). Needs a login to test that.
  { email: 'adarshanand.digal@nxtwave.co.in',    label: 'ABH  | Rajasthan   | Adarsh Anand Digal (ex-SBH, submits via Arka)' },

  // ── Full-regression per-state chains (added 2026-07-24) ────────────────────
  // Untouched-state SBHs + one representative SRO submitter each, so every
  // active state's submitter -> SBH -> Mansoor -> Finance path can be driven.
  // States already provisioned above: AP, KL, KA, TN, RJ.
  { email: 'ravinder.jangili@nxtwave.co.in',           label: 'SBH  | Telangana   | Ravinder Jangili' },
  { email: 'sambitkumar.aich@nxtwave.co.in',           label: 'SBH  | Odisha/WB   | Sambit Kumar Aich' },
  { email: 'indraneel.sanjayingole@nxtwave.co.in',     label: 'SRO  | Maharashtra | Indraneel Ingole (-> Ashish)' },
  { email: 'veerabhadraswamy.attili@nxtwave.co.in',    label: 'SRO  | Telangana   | Attili Veera Bhadra Swamy (-> Ravinder)' },
  { email: 'abhay.kumar@nxtwave.co.in',                label: 'SRO  | Delhi NCR   | Abhay Kumar (-> Bipin)' },
  { email: 'ashish.patel@nxtwave.co.in',               label: 'SRO  | Uttar Pradesh| Ashish Patel (-> Akshay)' },
  { email: 'badalranjan.rout@nxtwave.co.in',           label: 'SRO  | Odisha      | Badal Ranjan Rout (-> Sambit)' },
  { email: 'kushal.mukherjee@nxtwave.co.in',           label: 'SRO  | West Bengal | Kushal Mukherjee (-> Sambit)' },

  // Hierarchy-specific regression personas.
  { email: 'muhammed.hijas@nxtwave.co.in',             label: 'SRO  | Kerala      | Muhammed Hijas (ID converted NW1006377 -> NW0007045)' },
  { email: 'chandramouli.narina@nxtwave.co.in',        label: 'BOA  | Central     | Narina Chandramouli (approval_start_level=2 -> direct to HOD)' },
]

async function upsertTestUser(email) {
  const password = resolvePassword(email)

  const { data, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
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
      password,
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

  console.log('\n✅  Done. Accounts can now log in with:')
  console.log(`   Default password: ${DEFAULT_PASSWORD}`)
  for (const [email, password] of PASSWORD_OVERRIDES) {
    console.log(`   Override:         ${email} -> ${password}`)
  }
  console.log('')

  if (dbClient) {
    await dbClient.end()
    dbClient = null
  }
}

await main()
