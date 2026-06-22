import { test, expect } from './fixtures/auth'
import { ApprovalsPage } from './pages/approvals.page'
import { PM_MANSOOR, ZBH_MULTI_STATE, SBH_AP } from './fixtures/test-accounts'

/**
 * Regression net for the /approvals data path (Pending + History + filters).
 *
 * WHY: a high-scope approver (notably PM "mansoor", 8k+ acted claims / 105
 * pending subordinates) previously broke the page when claim/employee ids were
 * collected client-side and sent as a giant `.in(...)` URL filter (HTTP 414).
 * The History/Count/Analytics RPCs and now get_pending_approvals resolve scope
 * INSIDE Postgres, so request URLs must stay tiny forever. This spec fails loudly
 * if that ever regresses.
 *
 * NOTE: /approvals is a server component, so the Supabase RPC calls run on the
 * Next server, not in the browser. A server-side URL explosion therefore surfaces
 * to the browser as a >=400 on the /approvals document / RSC navigation (caught
 * below), while the URL-length guard directly bounds every client-visible request.
 * Requires migration 20260622091000_get_pending_approvals to be applied — without
 * it the pending RPC 404s and the page request fails the status guard.
 */

const MAX_URL_LENGTH = 6000

const SUPABASE_HOST = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
  .replace(/^https?:\/\//, '')
  .split('/')[0]

// Console noise unrelated to app correctness.
const BENIGN_CONSOLE = [/favicon/i, /ResizeObserver loop/i]

type Guards = {
  longUrls: string[]
  badResponses: string[]
  consoleErrors: string[]
  pageErrors: string[]
}

function installGuards(page: import('@playwright/test').Page): Guards {
  const g: Guards = {
    longUrls: [],
    badResponses: [],
    consoleErrors: [],
    pageErrors: [],
  }

  page.on('request', (req) => {
    const url = req.url()
    if (url.length > MAX_URL_LENGTH) {
      g.longUrls.push(`${req.method()} len=${url.length} ${url.slice(0, 140)}`)
    }
  })

  page.on('response', (res) => {
    const url = res.url()
    const status = res.status()
    const relevant =
      url.startsWith('http://localhost') ||
      (SUPABASE_HOST.length > 0 && url.includes(SUPABASE_HOST))
    // status 0 == aborted/cancelled navigation during fast clicks; ignore.
    if (relevant && status >= 400) {
      g.badResponses.push(`${status} ${url.slice(0, 180)}`)
    }
  })

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (BENIGN_CONSOLE.some((re) => re.test(text))) return
    g.consoleErrors.push(text)
  })

  page.on('pageerror', (err) => {
    g.pageErrors.push(err.message)
  })

  return g
}

function assertClean(g: Guards, label: string): void {
  expect(
    g.longUrls,
    `${label}: request URL(s) exceeded ${MAX_URL_LENGTH} chars — possible URL explosion`
  ).toEqual([])
  expect(g.badResponses, `${label}: response(s) with status >= 400`).toEqual([])
  expect(g.pageErrors, `${label}: uncaught page error(s)`).toEqual([])
  expect(g.consoleErrors, `${label}: console error(s)`).toEqual([])
}

async function hopPages(
  page: import('@playwright/test').Page,
  nextLink: import('@playwright/test').Locator,
  maxHops = 3
): Promise<void> {
  const visited = new Set<string>()
  for (let i = 0; i < maxHops; i += 1) {
    if ((await nextLink.count()) === 0) return
    const href = await nextLink.getAttribute('href')
    if (!href || visited.has(href)) return
    visited.add(href)
    await nextLink.click()
    await page.waitForLoadState('networkidle')
  }
}

// SBH (level-1 scope), ZBH (level-2 view scope), PM Mansoor (largest scope).
for (const account of [SBH_AP, ZBH_MULTI_STATE, PM_MANSOOR]) {
  test(`/approvals requests stay bounded and error-free — ${account.label}`, async ({
    page,
    loginAs,
  }) => {
    const guards = installGuards(page)
    const approvals = new ApprovalsPage(page)

    await loginAs(account.email)
    await approvals.goto()

    // Pending Approvals: page forward a few times.
    await hopPages(page, approvals.pendingNextLink)

    // Approval History: page forward a few times.
    await approvals.goto()
    await hopPages(page, approvals.historyNextLink)

    // Filter + refresh + back/forward (deep-link stability).
    await page.goto(
      '/approvals?claimDateFrom=2026-01-01&claimDateTo=2026-06-30'
    )
    await page.waitForLoadState('networkidle')
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.goBack()
    await page.waitForLoadState('networkidle')
    await page.goForward()
    await page.waitForLoadState('networkidle')

    assertClean(guards, account.label)
  })
}
