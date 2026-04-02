import { redirect } from 'next/navigation'
import { AlertTriangle, ShieldCheck, UserX } from 'lucide-react'

import { requireCurrentUser } from '@/features/auth/queries'
import { signOutAction } from '@/features/auth/actions'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getEmployeeByEmail } from '@/lib/services/employee-service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function NoAccessPage() {
  const user = await requireCurrentUser('/login')
  const supabase = await createSupabaseServerClient()
  let employee = null

  if (user.email) {
    try {
      employee = await getEmployeeByEmail(supabase, user.email)
    } catch {
      employee = null
    }
  }

  if (employee) {
    redirect('/dashboard')
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-52 -right-52 size-112 rounded-full bg-primary/6" />
        <div className="absolute -bottom-52 -left-52 size-96 rounded-full bg-warning-light" />
      </div>

      <section className="relative w-full max-w-2xl rounded-2xl border border-border bg-surface p-8 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-warning-light text-amber-600 dark:text-amber-400">
            <UserX className="size-6" aria-hidden="true" />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Access Required
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
              Your account is not provisioned yet
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              You have signed in successfully, but this Microsoft account does
              not have access to NxtExpense yet.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-background p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            What to do next
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              Contact your administrator to enable your employee profile and
              role access.
            </li>
            <li>
              Share this corporate email for provisioning: <b>{user.email}</b>
            </li>
            <li>Once access is granted, sign in again to continue.</li>
          </ul>
        </div>

        <div className="mt-5 rounded-xl border border-amber-500/20 bg-warning-light px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <p className="flex items-center gap-2">
            <AlertTriangle className="size-4" aria-hidden="true" />
            If this looks unexpected, please reach out to your system
            administrator.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold shadow-xs transition-all hover:bg-muted"
            >
              Sign out
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
