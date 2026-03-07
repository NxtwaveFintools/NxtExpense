import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase admin environment variables.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const financeUsers = [
  'finance1@nxtwave.co.in',
  'finance2@nxtwave.co.in',
  'finance3@nxtwave.co.in',
]

async function upsertFinanceUser(email) {
  const { data: usersData, error: listError } =
    await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

  if (listError) {
    throw new Error(`Unable to list users: ${listError.message}`)
  }

  const existing = usersData.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase()
  )

  if (existing) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      existing.id,
      {
        password: 'Password@123',
        email_confirm: true,
      }
    )

    if (updateError) {
      throw new Error(`Unable to update user ${email}: ${updateError.message}`)
    }

    return { email, id: existing.id, mode: 'updated' }
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: 'Password@123',
    email_confirm: true,
  })

  if (error) {
    throw new Error(`Unable to create user ${email}: ${error.message}`)
  }

  return { email, id: data.user.id, mode: 'created' }
}

async function main() {
  const results = []
  for (const email of financeUsers) {
    results.push(await upsertFinanceUser(email))
  }

  for (const result of results) {
    console.log(`${result.mode.toUpperCase()}: ${result.email} (${result.id})`)
  }
}

await main()
