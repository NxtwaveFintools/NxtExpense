import { type Locator, type Page } from '@playwright/test'

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
  const randomOffset = Math.floor(Math.random() * 997)

  return [
    ...Array.from({ length: 40 }, (_, i) => i + 1 + randomOffset),
    ...Array.from({ length: 30 }, (_, i) => 80 + i * 9 + randomOffset),
    ...Array.from({ length: 30 }, (_, i) => 720 + i * 60 + randomOffset),
  ]
}

async function isVisible(locator: Locator): Promise<boolean> {
  return locator.isVisible().catch(() => false)
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

async function hasMessageInMainOrToast(
  page: Page,
  messagePattern: RegExp
): Promise<boolean> {
  const mainCount = await page
    .getByRole('main')
    .getByText(messagePattern)
    .count()
  const notificationCount = await page
    .getByRole('region', { name: /notifications/i })
    .getByText(messagePattern)
    .count()
    .catch(() => 0)

  return mainCount > 0 || notificationCount > 0
}

type ValidationOutcome = 'date-collision' | 'matched' | 'timeout'

async function waitForValidationOutcome(
  page: Page,
  messagePattern: RegExp,
  timeoutMs = 30_000
): Promise<ValidationOutcome> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (await hasDateCollisionMessage(page)) {
      return 'date-collision'
    }

    if (await hasMessageInMainOrToast(page, messagePattern)) {
      return 'matched'
    }

    await page.waitForTimeout(200)
  }

  return 'timeout'
}

async function findOutstationOption(
  claims: ClaimsPage
): Promise<RuntimeWorkLocationOption> {
  const options = await claims.getWorkLocationOptions()

  for (const option of options) {
    await claims.selectWorkLocationByValue(option.value)

    if (await isVisible(claims.intercityOwnVehicleGroup)) {
      return option
    }
  }

  throw new Error(
    'Could not locate an outstation-style work location with own-vehicle prompts.'
  )
}

test.describe('Claim Form - Dynamic Work Location Matrix', () => {
  test('LOC-MATRIX-001: every runtime work location maps to exactly one UI branch', async ({
    page,
    loginAs,
  }) => {
    await loginAs(SRO_AP.email)

    const claims = new ClaimsPage(page)
    await claims.gotoNewClaim()

    const options = await claims.getWorkLocationOptions()

    expect(options.length).toBeGreaterThanOrEqual(3)
    expect(new Set(options.map((option) => option.value)).size).toBe(
      options.length
    )

    let baseBranchCount = 0
    let outstationBranchCount = 0
    let noExpenseBranchCount = 0

    for (const option of options) {
      await claims.selectWorkLocationByValue(option.value)

      const hasOutstationBranch = await isVisible(
        claims.intercityOwnVehicleGroup
      )
      const hasVehicleBranch =
        !hasOutstationBranch &&
        (await isVisible(claims.vehicleTypeSelect.first()))

      expect(hasOutstationBranch && hasVehicleBranch).toBe(false)

      if (hasOutstationBranch) {
        outstationBranchCount += 1

        await claims.intercityOwnVehicleYesButton.click()

        await expect(claims.outstationStateSelect).toBeVisible()
        await expect(claims.fromCityInput).toBeVisible()
        await expect(claims.toCityInput).toBeVisible()
        await expect(claims.kmInput).toBeVisible()
        await expect(claims.intracityOwnVehicleGroup).toHaveCount(0)
        await expect(claims.outstationCitySelect).toHaveCount(0)

        await claims.intercityOwnVehicleNoButton.click()

        await expect(claims.intracityOwnVehicleGroup).toBeVisible()
        await expect(claims.fromCityInput).toHaveCount(0)
        await expect(claims.toCityInput).toHaveCount(0)
        await expect(claims.kmInput).toHaveCount(0)

        await claims.intracityOwnVehicleYesButton.click()

        await expect(claims.outstationStateSelect).toBeVisible()
        await expect(claims.outstationCitySelect).toBeVisible()
        await expect(claims.vehicleTypeSelect.first()).toBeVisible()
        await expect(claims.kmInput).toHaveCount(0)

        await claims.intracityOwnVehicleNoButton.click()

        await expect(claims.outstationStateSelect).toHaveCount(0)
        await expect(claims.outstationCitySelect).toHaveCount(0)
        await expect(claims.vehicleTypeSelect).toHaveCount(0)
      } else if (hasVehicleBranch) {
        baseBranchCount += 1

        await expect(claims.vehicleTypeSelect.first()).toBeVisible()
        await expect(claims.intercityOwnVehicleGroup).toHaveCount(0)
      } else {
        noExpenseBranchCount += 1

        await expect(claims.vehicleTypeSelect).toHaveCount(0)
        await expect(claims.intercityOwnVehicleGroup).toHaveCount(0)
      }
    }

    expect(baseBranchCount).toBeGreaterThanOrEqual(1)
    expect(outstationBranchCount).toBeGreaterThanOrEqual(1)
    expect(noExpenseBranchCount).toBeGreaterThanOrEqual(1)
  })

  test('LOC-MATRIX-002: outstation submit enforces inter-city and intra-city decisions', async ({
    page,
    loginAs,
  }) => {
    await loginAs(SRO_AP.email)

    const claims = new ClaimsPage(page)
    await claims.gotoNewClaim()

    const outstationOption = await findOutstationOption(claims)

    let validationSeen = false

    for (const daysBack of buildCandidateDaysBack()) {
      await claims.selectWorkLocationByValue(outstationOption.value)
      await claims.dateInput.fill(toIsoDateDaysBack(daysBack))

      await claims.submitButton.click()

      const firstPromptOutcome = await waitForValidationOutcome(
        page,
        /please select whether you travelled between cities using your own vehicle\./i
      )

      if (firstPromptOutcome === 'date-collision') {
        continue
      }

      expect(firstPromptOutcome).toBe('matched')

      await claims.intercityOwnVehicleNoButton.click()
      await claims.submitButton.click()

      const secondPromptOutcome = await waitForValidationOutcome(
        page,
        /please select whether you travelled within the city using your own vehicle(?:\/rental vehicle)?\./i
      )

      expect(secondPromptOutcome).toBe('matched')

      validationSeen = true
      break
    }

    expect(validationSeen).toBe(true)
    expect(page.url()).toContain('/claims/new')
  })

  test('LOC-MATRIX-003: inter-city own-vehicle submit rejects same From and To city', async ({
    page,
    loginAs,
  }) => {
    await loginAs(SRO_AP.email)

    const claims = new ClaimsPage(page)
    await claims.gotoNewClaim()

    const outstationOption = await findOutstationOption(claims)

    await claims.selectWorkLocationByValue(outstationOption.value)
    await claims.intercityOwnVehicleYesButton.click()

    const stateOptionCount = await claims.outstationStateSelect
      .locator('option')
      .count()

    let selectedStateWithCities = false

    for (let stateIndex = 1; stateIndex < stateOptionCount; stateIndex += 1) {
      await claims.outstationStateSelect.selectOption({ index: stateIndex })

      await expect
        .poll(async () => claims.fromCityInput.locator('option').count())
        .toBeGreaterThan(1)

      const cityOptionCount = await claims.fromCityInput
        .locator('option')
        .count()

      if (cityOptionCount > 1) {
        selectedStateWithCities = true
        break
      }
    }

    if (!selectedStateWithCities) {
      throw new Error(
        'No active state/city data available to validate inter-city city checks.'
      )
    }

    await claims.fromCityInput.selectOption({ index: 1 })

    const selectedFromCity = await claims.fromCityInput.inputValue()
    expect(selectedFromCity).toBeTruthy()

    await claims.toCityInput.selectOption({ value: selectedFromCity })
    await claims.vehicleTypeSelect.first().selectOption({ index: 0 })
    await claims.kmInput.fill('25')

    let validationSeen = false

    for (const daysBack of buildCandidateDaysBack()) {
      await claims.dateInput.fill(toIsoDateDaysBack(daysBack))
      await claims.submitButton.click()

      const validationOutcome = await waitForValidationOutcome(
        page,
        /inter-city travel requires different from and to cities\./i
      )

      if (validationOutcome === 'date-collision') {
        continue
      }

      expect(validationOutcome).toBe('matched')

      validationSeen = true
      break
    }

    expect(validationSeen).toBe(true)
    expect(page.url()).toContain('/claims/new')
  })
})
