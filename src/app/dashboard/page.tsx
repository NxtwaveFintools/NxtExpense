import { LogoutButton } from '@/features/auth/components/logout-button'
import { requireCurrentUser } from '@/features/auth/queries'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export default async function DashboardPage() {
  const user = await requireCurrentUser('/login')

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-foreground/60">
              NxtExpense
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-foreground/70">
              Authenticated user landing page.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-medium">User Information</h2>
          <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
            <div className="space-y-1 rounded-lg border border-border bg-background p-4">
              <dt className="text-foreground/60">User ID</dt>
              <dd className="break-all">{user.id}</dd>
            </div>
            <div className="space-y-1 rounded-lg border border-border bg-background p-4">
              <dt className="text-foreground/60">Email</dt>
              <dd>{user.email ?? 'Not available'}</dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  )
}
