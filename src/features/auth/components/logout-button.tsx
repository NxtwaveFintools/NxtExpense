import { signOutAction } from '@/features/auth/actions'

export function LogoutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
      >
        Logout
      </button>
    </form>
  )
}
