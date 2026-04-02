import { type Page } from '@playwright/test'

import { test, expect } from './fixtures/auth'
import { SRO_AP } from './fixtures/test-accounts'
import { ClaimsPage } from './pages/claims.page'

type RuntimeWorkLocationOption = {
  value: string
  label: string
}

function toIsoDateDaysBack(daysBack: number): string {
  const candidateDate = new Date()
  candidateDate.setDate(candidateDate.getDate() - daysBack)
  const yyyy = candidateDate.getFullYear()
  const mm = String(candidateDate.getMonth() + 1).padStart(2, '0')
  const dd = String(candidateDate.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function buildCandidateDaysBack(): number[] {
  const randomOffset = Math.floor(Math.random() * 120)

  return Array.from({ length: 120 }, (_, i) => 1 + ((i + randomOffset) % 120))
}

async function hasDateCollisionMessage(page: Page): Promise<boolean> {
  const duplicateDateError =
    (await page
      .getByText(
        /already have a pending or approved claim for this date|already have .*claim for this date|claim already submitted for this date/i
      )
      .count()) > 0

  const duplicateConstraintError =
    (await page
      .getByText(/duplicate key value violates unique constraint/i)
      .count()) > 0

  const permanentlyClosedError =
    (await page.getByText(/permanently closed/i).count()) > 0

  return (
    duplicateDateError || duplicateConstraintError || permanentlyClosedError
  )
}

async function findOutstationOption(
  claims: ClaimsPage,
  page: Page
): Promise<RuntimeWorkLocationOption> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const options = await claims.getWorkLocationOptions()

    for (const option of options) {
      await claims.selectWorkLocationByValue(option.value)
      await page.waitForTimeout(120)

      if (
        await claims.intercityOwnVehicleGroup.isVisible().catch(() => false)
      ) {
        return option
      }

      if (option.label.toLowerCase().includes('outstation')) {
        return option
      }
    }

    await page.waitForTimeout(250)
  }

  throw new Error(
    'Could not locate an outstation work location with travel prompts.'
  )
}

async function selectStateAndCityWithData(claims: ClaimsPage): Promise<void> {
  const stateOptions = claims.outstationStateSelect.locator('option')
  const stateCount = await stateOptions.count()

  for (let stateIndex = 1; stateIndex < stateCount; stateIndex += 1) {
    await claims.outstationStateSelect.selectOption({ index: stateIndex })

    await expect
      .poll(async () => claims.outstationCitySelect.locator('option').count())
      .toBeGreaterThan(1)

    const cityCount = await claims.outstationCitySelect
      .locator('option')
      .count()
    if (cityCount > 1) {
      await claims.outstationCitySelect.selectOption({ index: 1 })
      return
    }
  }

  throw new Error(
    'No active state/city data available for outstation rental test.'
  )
}

async function submitOutstationRentalClaimAndGetNumber(
  page: Page,
  claims: ClaimsPage,
  outstationOption: RuntimeWorkLocationOption
): Promise<string> {
  await claims.ensureNewClaimFormReady()
  await claims.selectWorkLocationByValue(outstationOption.value)
  await claims.intercityOwnVehicleNoButton.click()
  await claims.intracityOwnVehicleYesButton.click()
  await claims.intracityVehicleModeRentalButton.click()

  await selectStateAndCityWithData(claims)
  await claims.vehicleTypeSelect.first().selectOption({ index: 0 })

  for (const daysBack of buildCandidateDaysBack()) {
    const claimDateIso = toIsoDateDaysBack(daysBack)

    await claims.ensureNewClaimFormReady()
    await claims.fillClaimDate(claimDateIso)
    await expect(claims.submitButton).toBeEnabled({ timeout: 20_000 })
    await claims.submitButton.click()

    let navigatedToClaims = false

    try {
      await page.waitForURL((url: URL) => url.pathname === '/claims', {
        timeout: 7_000,
      })
      navigatedToClaims = true
    } catch {
      let submitButtonEnabled = false

      for (let retry = 0; retry < 20; retry += 1) {
        try {
          submitButtonEnabled = await claims.submitButton.isEnabled()
          if (submitButtonEnabled) {
            break
          }
        } catch {
          submitButtonEnabled = false
        }

        await page.waitForTimeout(500)
      }

      if (!submitButtonEnabled) {
        await claims.gotoNewClaim()
        await claims.ensureNewClaimFormReady()
      }

      const submittedClaimNumber =
        (await claims.getSubmittedClaimNumberFromSuccessToast(5_000)) ??
        (new URL(page.url()).pathname === '/claims'
          ? await claims.getClaimNumberForDate(claimDateIso)
          : null)

      if (submittedClaimNumber) {
        expect(submittedClaimNumber).toMatch(/^CLAIM-/i)
        return submittedClaimNumber
      }

      if (await hasDateCollisionMessage(page)) {
        continue
      }

      throw new Error(
        'Outstation rental claim submission failed with an unexpected error.'
      )
    }

    const claimNumber =
      (await claims.getSubmittedClaimNumberFromSuccessToast(
        navigatedToClaims ? 1_500 : 5_000
      )) ??
      (new URL(page.url()).pathname === '/claims'
        ? await claims.getClaimNumberForDate(claimDateIso)
        : null)

    if (claimNumber) {
      expect(claimNumber).toMatch(/^CLAIM-/i)
      return claimNumber
    }
  }

  throw new Error('Could not submit an outstation rental claim after retries.')
}

test.describe('Claim Detail Line Items', () => {
  test.describe.configure({ timeout: 240_000 })

  test('shows exact Rented/Own Fuel Allowance text for outstation rental claims', async ({
    page,
    loginAs,
  }) => {
    await loginAs(SRO_AP.email)

    const claims = new ClaimsPage(page)
    await claims.gotoNewClaim()

    const outstationOption = await findOutstationOption(claims, page)
    const claimNumber = await submitOutstationRentalClaimAndGetNumber(
      page,
      claims,
      outstationOption
    )

    await claims.openClaimByNumber(claimNumber)

    await expect(
      page.getByRole('heading', { name: /^Claim Details$/i })
    ).toBeVisible({ timeout: 20_000 })

    const lineItemsHeading = page.getByRole('heading', {
      name: /^Line Items$/i,
    })
    await expect(lineItemsHeading).toBeVisible({ timeout: 20_000 })

    const lineItemsSection = page
      .locator('section')
      .filter({ has: lineItemsHeading })
      .first()

    const fuelAllowanceLabel = lineItemsSection
      .getByText(/^Rented\/Own Fuel Allowance$/)
      .first()

    await expect(fuelAllowanceLabel).toBeVisible({ timeout: 20_000 })
    await expect(fuelAllowanceLabel).toHaveText('Rented/Own Fuel Allowance')
    await expect(lineItemsSection).toContainText(/rented vehicle travel/i)
  })
})
