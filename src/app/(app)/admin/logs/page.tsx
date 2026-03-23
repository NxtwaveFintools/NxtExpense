import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  buildCursorNavigationLinks,
  decodeCursorTrail,
  encodeCursorTrail,
} from '@/lib/utils/pagination'
import { formatDatetime } from '@/lib/utils/date'
import { CursorPaginationControls } from '@/components/ui/cursor-pagination-controls'
import {
  getAdminLogFilterOptions,
  getAdminLogsPaginated,
} from '@/features/admin/queries/admin-logs'

type AdminLogsPageProps = {
  searchParams?: Promise<{
    cursor?: string
    trail?: string
    actionType?: string
    entityType?: string
    search?: string
  }>
}

export default async function AdminLogsPage({
  searchParams,
}: AdminLogsPageProps) {
  const supabase = await createSupabaseServerClient()
  const resolvedSearch = await searchParams

  const cursor = resolvedSearch?.cursor ?? null
  const trail = decodeCursorTrail(resolvedSearch?.trail ?? null)

  const filters = {
    actionType: resolvedSearch?.actionType?.trim() || null,
    entityType: resolvedSearch?.entityType?.trim() || null,
    search: resolvedSearch?.search?.trim() || null,
  }

  const [logPage, filterOptions] = await Promise.all([
    getAdminLogsPaginated(supabase, cursor, 20, filters),
    getAdminLogFilterOptions(supabase),
  ])

  const baseQuery = {
    actionType: filters.actionType ?? undefined,
    entityType: filters.entityType ?? undefined,
    search: filters.search ?? undefined,
  }

  const pagination = buildCursorNavigationLinks({
    pathname: '/admin/logs',
    query: {
      ...baseQuery,
      cursor: cursor ?? undefined,
      trail: trail.length > 0 ? encodeCursorTrail(trail) : undefined,
    },
    cursorKey: 'cursor',
    trailKey: 'trail',
    currentCursor: cursor,
    currentTrail: trail,
    nextCursor: logPage.nextCursor,
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Admin Logs</h2>
        <p className="text-sm text-foreground/60">
          Auditable history of admin mutations across employees and
          configuration.
        </p>
      </div>

      <form className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-4">
        <input type="hidden" name="cursor" value="" />
        <input type="hidden" name="trail" value="" />

        <input
          type="text"
          name="search"
          defaultValue={filters.search ?? ''}
          placeholder="Search action/entity"
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        />

        <select
          name="actionType"
          defaultValue={filters.actionType ?? ''}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All Actions</option>
          {filterOptions.actionTypes.map((actionType) => (
            <option key={actionType} value={actionType}>
              {actionType}
            </option>
          ))}
        </select>

        <select
          name="entityType"
          defaultValue={filters.entityType ?? ''}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All Entities</option>
          {filterOptions.entityTypes.map((entityType) => (
            <option key={entityType} value={entityType}>
              {entityType}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Apply Filters
        </button>
      </form>

      <CursorPaginationControls
        backHref={pagination.backHref}
        nextHref={pagination.nextHref}
        pageNumber={pagination.pageNumber}
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Timestamp
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Admin
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Action
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Entity
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Before
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                After
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logPage.data.map((log) => (
              <tr key={log.id} className="align-top hover:bg-muted/30">
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatDatetime(log.created_at)}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">
                    {log.admin_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {log.admin_email}
                  </p>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-foreground">
                  {log.action_type}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">
                    {log.entity_type}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {log.entity_id ?? '-'}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <pre className="max-w-[260px] overflow-x-auto rounded bg-muted/40 p-2 text-xs text-muted-foreground">
                    {JSON.stringify(log.old_value ?? {}, null, 2)}
                  </pre>
                </td>
                <td className="px-4 py-3">
                  <pre className="max-w-[260px] overflow-x-auto rounded bg-muted/40 p-2 text-xs text-muted-foreground">
                    {JSON.stringify(log.new_value ?? {}, null, 2)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {logPage.data.length === 0 && (
        <p className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
          No admin logs found for the selected filters.
        </p>
      )}
    </div>
  )
}
