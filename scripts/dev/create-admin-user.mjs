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

const adminEmail = 'expenseadmin@nxtwave.co.in'
const adminPassword = 'Password@123'

async function upsertAdminUser() {
  const { data: usersData, error: listError } =
    await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

  if (listError) {
    throw new Error(`Unable to list users: ${listError.message}`)
  }

  const existing = usersData.users.find(
    (user) => user.email?.toLowerCase() === adminEmail.toLowerCase()
  )

  if (existing) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      existing.id,
      {
        password: adminPassword,
        email_confirm: true,
      }
    )

    if (updateError) {
      throw new Error(`Unable to update user ${adminEmail}: ${updateError.message}`)
    }

    console.log(`✅ Updated existing auth user: ${adminEmail} (${existing.id})`)
    return
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  })

  if (error) {
    throw new Error(`Unable to create user ${adminEmail}: ${error.message}`)
  }

  console.log(`✅ Created auth user: ${adminEmail} (${data.user.id})`)
  console.log('   Note: employee record is seeded via migration 140.')
}

upsertAdminUser().catch((err) => {
  console.error('❌ Admin user setup failed:', err.message)
  process.exit(1)
})
