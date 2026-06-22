import { type Locator, type Page } from '@playwright/test'

import { test, expect } from './fixtures/auth'
import {
  ABH_TAMIL_NADU,
  BOA_KARNATAKA,
  FINANCE_1,
  FINANCE_2,
  PM_MANSOOR,
  SBH_AP,
  SBH_KARNATAKA,
  SBH_TN_KERALA,
  SRO_AP,
  SRO_KERALA,
  ZBH_MULTI_STATE,
} from './fixtures/test-accounts'
import { ApprovalsPage } from './pages/approvals.page'
import { ClaimsPage } from './pages/claims.page'
import { FinancePage } from './pages/finance.page'
import { resolveExpectedFoodForSubmitter } from './utils/expense-rates-db'

type LoginAs = (email: string) => Promise<void>
type ClaimMode = 'base' | 'outstation'

type WorkflowScenario = {
  name: string
  submitterEmail: string
  approverEmails: string[]
  financeEmail: string
  outstationStateName: string
}

const STANDARD_FIRST_SCENARIOS: WorkflowScenario[] = [
  {
    name: 'G1 Kerala standard flow',
    submitterEmail: SRO_KERALA.email,
    approverEmails: [SBH_TN_KERALA.email, PM_MANSOOR.email],
    financeEmail: FINANCE_1.email,
    outstationStateName: 'Kerala',
  },
  {
    name: 'G1 Karnataka standard flow',
    submitterEmail: BOA_KARNATAKA.email,
    approverEmails: [SBH_KARNATAKA.email, PM_MANSOOR.email],
    financeEmail: FINANCE_1.email,
    outstationStateName: 'Karnataka',
  },
  {
    name: 'G1 Tamil Nadu replacement direct flow',
    submitterEmail: ABH_TAMIL_NADU.email,
    approverEmails: [PM_MANSOOR.email],
    financeEmail: FINANCE_1.email,
    outstationStateName: 'Tamil Nadu',
  },
  {
    name: 'G2 Karnataka standard direct flow',
    submitterEmail: SBH_KARNATAKA.email,
    approverEmails: [PM_MANSOOR.email],
    financeEmail: FINANCE_2.email,
    outstationStateName: 'Karnataka',
  },
  {
    name: 'G2 ZBH standard direct flow',
    submitterEmail: ZBH_MULTI_STATE.email,
    approverEmails: [PM_MANSOOR.email],
    financeEmail: FINANCE_2.email,
    outstationStateName: 'Karnataka',
  },
  {
    name: 'G2 PM direct to finance flow',
    submitterEmail: PM_MANSOOR.email,
    approverEmails: [],
    financeEmail: FINANCE_2.email,
    outstationStateName: 'Karnataka',
  },
  {
    name: 'G1 AP target flow',
    submitterEmail: SRO_AP.email,
    approverEmails: [SBH_AP.email, PM_MANSOOR.email],
    financeEmail: FINANCE_1.email,
    outstationStateName: 'Andhra Pradesh',
  },
  {
    name: 'G2 AP target direct flow',
    submitterEmail: SBH_AP.email,
    approverEmails: [PM_MANSOOR.email],
    financeEmail: FINANCE_2.email,
    outstationStateName: 'Telangana',
  },
]

const FAST_SCENARIO_NAMES = new Set<string>([
  'G1 Kerala standard flow',
  'G2 PM direct to finance flow',
  'G1 AP target flow',
])

const RUN_FULL_MATRIX = process.env.PW_FULL_MATRIX === '1'

function resolveActiveClaimModes(): ClaimMode[] {
  const configuredModes = (process.env.PW_FOOD_OVERRIDE_MODES ?? '')
    .split(',')
    .map((mode) => mode.trim().toLowerCase())
    .filter(Boolean)

  const parsedModes = configuredModes.filter(
    (mode): mode is ClaimMode => mode === 'base' || mode === 'outstation'
  )

  if (parsedModes.length > 0) {
    return parsedModes
  }

  // Fast mode defaults to the heaviest branch; full mode runs both.
  return RUN_FULL_MATRIX ? ['base', 'outstation'] : ['outstation']
}

const ACTIVE_MODES = resolveActiveClaimModes()
const ACTIVE_SCENARIOS = RUN_FULL_MATRIX
  ? STANDARD_FIRST_SCENARIOS
  : STANDARD_FIRST_SCENARIOS.filter((scenario) =>
      FAST_SCENARIO_NAMES.has(scenario.name)
    )
const MATRIX_TIMEOUT_MS = RUN_FULL_MATRIX ? 600_000 : 300_000

function toIsoDateDaysBack(daysBack: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysBack)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

async function clearSession(page: Page): Promise<void> {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.evaluate(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
  await page.context().clearCookies()
}

async function loginAsFresh(
  page: Page,
  loginAs: LoginAs,
  email: string
): Promise<void> {
  await clearSession(page)
  await loginAs(email)
}

function isInvalidCredentialsError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : ''

  return /invalid login credentials/i.test(message)
}

async function canLogin(
  page: Page,
  loginAs: LoginAs,
  email: string
): Promise<boolean> {
  try {
    await loginAsFresh(page, loginAs, email)
    return true
  } catch (error) {
    if (isInvalidCredentialsError(error)) {
      return false
    }

    throw error
  }
}

async function selectFirstNonEmptyOption(select: Locator): Promise<void> {
  const options = select.locator('option')
  const count = await options.count()

  for (let index = 0; index < count; index += 1) {
    const option = options.nth(index)
    const value = (await option.getAttribute('value'))?.trim() ?? ''

    if (!value) {
      continue
    }

    await select.selectOption({ value })
    return
  }

  throw new Error('No selectable option found.')
}

function hasDateCollision(page: Page): Promise<boolean> {
  return page
    .getByText(
      /already have a pending or approved claim for this date|already have .*claim for this date|claim already submitted for this date|duplicate key value violates unique constraint/i
    )
    .count()
    .then((count) => count > 0)
}

async function submitClaimAndCaptureAmounts(
  page: Page,
  loginAs: LoginAs,
  scenario: WorkflowScenario,
  mode: ClaimMode
): Promise<{ claimNumber: string; foodAmount: number; totalAmount: number }> {
  await loginAsFresh(page, loginAs, scenario.submitterEmail)

  const claims = new ClaimsPage(page)

  const randomOffset = Math.floor(Math.random() * 1997)
  const candidateWindow = RUN_FULL_MATRIX ? 120 : 45
  const candidateDaysBack = Array.from(
    { length: candidateWindow },
    (_, i) => i + 1 + randomOffset
  )

  for (const daysBack of candidateDaysBack) {
    const claimDateIso = toIsoDateDaysBack(daysBack)

    await claims.gotoNewClaim()
    await claims.ensureNewClaimFormReady()

    if (mode === 'base') {
      await claims.selectWorkLocationByName('Field - Base Location')
      await selectFirstNonEmptyOption(claims.vehicleTypeSelect.first())
    } else {
      await claims.selectWorkLocationByName('Field - Outstation')
      await claims.intercityOwnVehicleNoButton.click()
      await claims.intracityOwnVehicleYesButton.click()
      await claims.intracityVehicleModeRentalButton.click()
      await claims.outstationStateSelect.selectOption({
        label: scenario.outstationStateName,
      })

      await expect
        .poll(async () => claims.outstationCitySelect.locator('option').count())
        .toBeGreaterThan(1)

      await claims.outstationCitySelect.selectOption({ index: 1 })
      await selectFirstNonEmptyOption(claims.vehicleTypeSelect.first())
    }

    await claims.fillClaimDate(claimDateIso)
    await expect(claims.submitButton).toBeEnabled({ timeout: 20_000 })
    await claims.submitButton.click()

    if (await hasDateCollision(page)) {
      continue
    }

    const claimNumber =
      (await claims.getSubmittedClaimNumberFromSuccessToast(3_000)) ??
      (new URL(page.url()).pathname === '/claims'
        ? await claims.getClaimNumberForDate(claimDateIso)
        : null)

    if (!claimNumber) {
      continue
    }

    await claims.openClaimByNumber(claimNumber)

    const foodAmount = await claims.getClaimDetailFoodAllowanceAmount()
    const totalAmount = await claims.getClaimDetailTotalAmount()

    return { claimNumber, foodAmount, totalAmount }
  }

  throw new Error(`Unable to submit a ${mode} claim for ${scenario.name}.`)
}

async function assertClaimAmountsInApprovalsAndApprove(
  page: Page,
  loginAs: LoginAs,
  approverEmail: string,
  claimNumber: string,
  expectedFood: number,
  expectedTotal: number
): Promise<void> {
  await loginAsFresh(page, loginAs, approverEmail)

  const approvals = new ApprovalsPage(page)
  await approvals.goto()

  await approvals.waitForPendingRowByClaimNumber(claimNumber)
  await approvals.openPendingClaimByNumber(claimNumber)

  const claims = new ClaimsPage(page)
  await expect(claims.getClaimDetailFoodAllowanceAmount()).resolves.toBe(
    expectedFood
  )
  await expect(claims.getClaimDetailTotalAmount()).resolves.toBe(expectedTotal)

  await page.getByRole('button', { name: /^Approve$/i }).click()

  await expect
    .poll(
      async () => {
        await approvals.goto()
        return (await approvals.hasPendingRowByClaimNumber(claimNumber)) ? 1 : 0
      },
      { timeout: 30_000 }
    )
    .toBe(0)
}

async function assertClaimAmountsInFinanceAndRelease(
  page: Page,
  loginAs: LoginAs,
  financeEmail: string,
  claimNumber: string,
  expectedFood: number,
  expectedTotal: number
): Promise<void> {
  await loginAsFresh(page, loginAs, financeEmail)

  const finance = new FinancePage(page)
  const claims = new ClaimsPage(page)

  await finance.goto()
  await finance.filterByClaimNumber(claimNumber)
  await expect(finance.getQueueRowByClaimNumber(claimNumber)).toBeVisible({
    timeout: 20_000,
  })

  await finance.openQueueClaimByNumber(claimNumber)
  await expect(claims.getClaimDetailFoodAllowanceAmount()).resolves.toBe(
    expectedFood
  )
  await expect(claims.getClaimDetailTotalAmount()).resolves.toBe(expectedTotal)

  await finance.goto()
  await finance.filterByClaimNumber(claimNumber)
  await finance.getQueueCheckboxByClaimNumber(claimNumber).check()
  await finance.bulkIssueButton.click()

  await expect
    .poll(async () => finance.getQueueRowByClaimNumber(claimNumber).count(), {
      timeout: 20_000,
    })
    .toBe(0)

  await finance.gotoApprovedHistory()
  await finance.filterHistoryByClaimNumber(claimNumber)

  const historyRow = finance.getHistoryRowByClaimNumber(claimNumber)
  await expect(historyRow).toBeVisible({ timeout: 20_000 })

  const historyClaimLink = historyRow.locator('a[href*="/claims/"]').first()
  if (RUN_FULL_MATRIX && (await historyClaimLink.count()) > 0) {
    await historyClaimLink.click()
    await expect(claims.getClaimDetailFoodAllowanceAmount()).resolves.toBe(
      expectedFood
    )
    await expect(claims.getClaimDetailTotalAmount()).resolves.toBe(
      expectedTotal
    )
    await finance.gotoApprovedHistory()
    await finance.filterHistoryByClaimNumber(claimNumber)
  }

  await finance.getHistoryCheckboxByClaimNumber(claimNumber).check()
  await finance.bulkReleaseButton.click()

  // Each poll iteration re-navigates to history + re-filters, which can take
  // several seconds under heavy parallel load, so the default 5s budget is too
  // tight to fit even one round. Give it a generous, explicit timeout.
  await expect
    .poll(
      async () => {
        await finance.gotoApprovedHistory()
        await finance.filterHistoryByClaimNumber(claimNumber)
        return (
          (await finance
            .getHistoryRowByClaimNumber(claimNumber)
            .textContent()) ?? ''
        )
      },
      { timeout: 45_000 }
    )
    .toContain('Payment Released')
}

test.describe.serial('State Food Override - Approval Matrix', () => {
  test.describe.configure({ timeout: MATRIX_TIMEOUT_MS })

  test.skip(
    ACTIVE_SCENARIOS.length === 0,
    'No active scenarios selected for this runtime profile.'
  )

  test.skip(
    ACTIVE_MODES.length === 0,
    'No valid claim modes selected. Use PW_FOOD_OVERRIDE_MODES=base,outstation.'
  )

  for (const mode of ACTIVE_MODES) {
    test(`validates ${mode} claim food overrides across active approval chains`, async ({
      page,
      loginAs,
    }) => {
      const uniqueEmails = new Set<string>()
      for (const scenario of ACTIVE_SCENARIOS) {
        uniqueEmails.add(scenario.submitterEmail)
        uniqueEmails.add(scenario.financeEmail)
        for (const approverEmail of scenario.approverEmails) {
          uniqueEmails.add(approverEmail)
        }
      }

      const loginStatusByEmail = new Map<string, boolean>()
      for (const email of uniqueEmails) {
        loginStatusByEmail.set(email, await canLogin(page, loginAs, email))
      }

      const executableScenarios = ACTIVE_SCENARIOS.filter((scenario) => {
        const participants = [
          scenario.submitterEmail,
          ...scenario.approverEmails,
          scenario.financeEmail,
        ]

        return participants.every(
          (email) => loginStatusByEmail.get(email) === true
        )
      })

      test.skip(
        executableScenarios.length === 0,
        'No scenario has all required accounts with valid credentials in this environment.'
      )

      for (const scenario of executableScenarios) {
        const { claimNumber, foodAmount, totalAmount } =
          await submitClaimAndCaptureAmounts(page, loginAs, scenario, mode)

        // The orchestrator snapshots the food allowance active *today* for the
        // submitter's *primary* state (state override → national fallback).
        // Derive the same value from the DB so this stays correct as rates are
        // re-priced or per-state overrides come and go.
        const expectedFood = await resolveExpectedFoodForSubmitter(
          scenario.submitterEmail,
          mode
        )

        expect(foodAmount, `${scenario.name} ${mode} food amount`).toBe(
          expectedFood
        )

        for (const approverEmail of scenario.approverEmails) {
          await assertClaimAmountsInApprovalsAndApprove(
            page,
            loginAs,
            approverEmail,
            claimNumber,
            expectedFood,
            totalAmount
          )
        }

        await assertClaimAmountsInFinanceAndRelease(
          page,
          loginAs,
          scenario.financeEmail,
          claimNumber,
          expectedFood,
          totalAmount
        )
      }
    })
  }
})
