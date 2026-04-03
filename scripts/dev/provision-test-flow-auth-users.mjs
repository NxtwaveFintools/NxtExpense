/**
 * Provisions test-flow auth users via Supabase Auth Admin API only.
 * Avoids direct SQL writes to auth.* tables.
 *
 * Run:
 *   node --env-file=.env.local scripts/dev/provision-test-flow-auth-users.mjs
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.'
  )
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PASSWORD = 'Password@123'

const TEST_FLOW_USERS = [
  { email: 'sro@nxtwave.co.in', label: 'Test Flow SRO' },
  { email: 'sbh@nxtwave.co.in', label: 'Test Flow SBH' },
  { email: 'hod@nxtwave.co.in', label: 'Test Flow PM' },
  { email: 'finance1@nxtwave.co.in', label: 'Test Flow Finance 1' },
]

function adminHeaders() {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  }
}

function isAlreadyRegisteredError(error) {
  const message = (error?.message ?? '').toLowerCase()
  return (
    message.includes('already been registered') ||
    message.includes('already registered') ||
    message.includes('duplicate')
  )
}

async function findUserByEmail(email) {
  const normalizedEmail = email.toLowerCase().trim()
  const filter = encodeURIComponent(`email.eq.${normalizedEmail}`)
  const url = `${supabaseUrl}/auth/v1/admin/users?filter=${filter}`

  const response = await fetch(url, {
    method: 'GET',
    headers: adminHeaders(),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const reason = payload?.msg ?? payload?.error_description ?? payload?.error ?? response.statusText
    throw new Error(`Unable to query admin users by email (${normalizedEmail}): ${reason}`)
  }

  const users = Array.isArray(payload?.users) ? payload.users : []
  return (
    users.find((user) => (user.email ?? '').toLowerCase() === normalizedEmail) ??
    null
  )
}

async function upsertPasswordUser(email) {
  const normalizedEmail = email.toLowerCase().trim()

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password: PASSWORD,
    email_confirm: true,
  })

  if (!createError) {
    return { mode: 'created', userId: created.user.id }
  }

  if (!isAlreadyRegisteredError(createError)) {
    throw new Error(`Create failed for ${normalizedEmail}: ${createError.message}`)
  }

  const existing = await findUserByEmail(normalizedEmail)

  if (!existing?.id) {
    throw new Error(
      `User ${normalizedEmail} appears to exist but could not be fetched by admin filter. ` +
        'Run rollback script first and retry.'
    )
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    existing.id,
    {
      password: PASSWORD,
      email_confirm: true,
    }
  )

  if (updateError) {
    throw new Error(`Update failed for ${normalizedEmail}: ${updateError.message}`)
  }

  return { mode: 'updated', userId: existing.id }
}

async function main() {
  console.log('\nProvisioning test-flow auth users (safe mode)\n')
  console.log(`${'Email'.padEnd(35)} ${'Label'.padEnd(26)} Status`)
  console.log('-'.repeat(80))

  let failed = false

  for (const account of TEST_FLOW_USERS) {
    try {
      const result = await upsertPasswordUser(account.email)
      const status = result.mode === 'created' ? 'CREATED' : 'UPDATED'
      console.log(
        `${account.email.padEnd(35)} ${account.label.padEnd(26)} ${status} (${result.userId})`
      )
    } catch (error) {
      failed = true
      console.error(
        `${account.email.padEnd(35)} ${account.label.padEnd(26)} ERROR: ${error.message}`
      )
    }
  }

  if (failed) {
    console.log('\nCompleted with errors. Resolve failed rows and re-run the script.\n')
    process.exitCode = 1
    return
  }

  console.log('\nDone. All test-flow auth users are ready with password: Password@123\n')
}

await main()