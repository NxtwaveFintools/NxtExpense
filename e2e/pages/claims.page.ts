import { expect, type Page } from '@playwright/test'

const NAVIGATION_MAX_ATTEMPTS = 3
const NAVIGATION_RETRY_DELAY_MS = 500

type WorkLocationOption = {
  value: string
  label: string
}

export class ClaimsPage {
  constructor(private page: Page) {}

  private normalizeOptionLabel(value: string): string {
    return value
      .replace(/[–—]/g, '-')
      .replace(/\s*\/\s*/g, '/')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  }

  private async navigateWithRetry(pathname: string): Promise<void> {
    for (let attempt = 1; attempt <= NAVIGATION_MAX_ATTEMPTS; attempt += 1) {
      try {
        await this.page.goto(pathname, { timeout: 30_000 })
        await this.page.waitForLoadState('networkidle')
        return
      } catch (error) {
        if (attempt === NAVIGATION_MAX_ATTEMPTS) {
          throw error
        }

        await this.page.waitForTimeout(NAVIGATION_RETRY_DELAY_MS * attempt)
      }
    }
  }

  async goto() {
    await this.navigateWithRetry('/claims')
  }

  async gotoNewClaim() {
    await this.navigateWithRetry('/claims/new')
  }

  async ensureNewClaimFormReady(timeoutMs = 20_000) {
    const maxAttempts = 3

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const currentPath = new URL(this.page.url()).pathname
      if (currentPath !== '/claims/new') {
        await this.gotoNewClaim()
      }

      try {
        await expect(this.page).toHaveURL(/\/claims\/new(?:\?.*)?$/, {
          timeout: timeoutMs,
        })
        await this.dateInput.waitFor({ state: 'visible', timeout: timeoutMs })
        await this.workLocationSelect.waitFor({
          state: 'visible',
          timeout: timeoutMs,
        })
        return
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error
        }

        await this.gotoNewClaim()
        await this.page.waitForTimeout(400)
      }
    }
  }

  async fillClaimDate(dateIso: string, maxAttempts = 4) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await this.ensureNewClaimFormReady()

      try {
        await this.dateInput.fill(dateIso)
        return
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw error
        }

        await this.page.waitForTimeout(150)
      }
    }
  }

  async getSubmittedClaimNumberFromSuccessToast(
    timeoutMs = 6_000
  ): Promise<string | null> {
    const deadline = Date.now() + timeoutMs
    const successPattern = /claim submitted successfully\s*\((claim-[^)]+)\)/i

    while (Date.now() < deadline) {
      const toastTexts = await this.page
        .getByText(/claim submitted successfully/i)
        .allTextContents()

      for (const toastText of toastTexts) {
        const match = toastText.match(successPattern)
        if (match?.[1]) {
          return match[1]
        }
      }

      await this.page.waitForTimeout(120)
    }

    return null
  }

  // ── Form elements ──────────────────────────────────────────────────────

  get dateInput() {
    return this.page.locator('input[name="claimDate"]')
  }

  get workLocationSelect() {
    return this.page.locator('select[name="workLocation"]')
  }

  get expenseLocationSelect() {
    return this.page.locator('select[name="expenseLocationId"]')
  }

  get vehicleTypeSelect() {
    return this.page.locator('select[name="vehicleType"]')
  }

  get baseLocationDayTypeSelect() {
    return this.page.locator('select[name="baseLocationDayTypeCode"]')
  }

  get intercityOwnVehicleGroup() {
    return this.page.getByRole('group', {
      name: /did you travel between cities using your own vehicle\?/i,
    })
  }

  get intracityOwnVehicleGroup() {
    return this.page.getByRole('group', {
      name: /did you travel within the city using your own vehicle(?:\/rental vehicle)?\?/i,
    })
  }

  get outstationCitySelect() {
    return this.page.locator('select[name="outstationCityId"]')
  }

  get intracityVehicleModeGroup() {
    return this.page.getByRole('group', {
      name: /vehicle type used within the city/i,
    })
  }

  // Outstation own-vehicle selections are represented as yes/no button groups.
  get intercityOwnVehicleYesButton() {
    return this.intercityOwnVehicleGroup.getByRole('button', { name: 'Yes' })
  }

  get intercityOwnVehicleNoButton() {
    return this.intercityOwnVehicleGroup.getByRole('button', { name: 'No' })
  }

  get intracityOwnVehicleYesButton() {
    return this.intracityOwnVehicleGroup.getByRole('button', { name: 'Yes' })
  }

  get intracityOwnVehicleNoButton() {
    return this.intracityOwnVehicleGroup.getByRole('button', { name: 'No' })
  }

  get intracityVehicleModeOwnButton() {
    return this.intracityVehicleModeGroup.getByRole('button', {
      name: /own vehicle/i,
    })
  }

  get intracityVehicleModeRentalButton() {
    return this.intracityVehicleModeGroup.getByRole('button', {
      name: /rent vehicle/i,
    })
  }

  get kmInput() {
    return this.page.locator('input[name="kmTravelled"]')
  }

  get fromCityInput() {
    return this.page.locator('select[name="fromCityId"]')
  }

  get toCityInput() {
    return this.page.locator('select[name="toCityId"]')
  }

  get outstationStateSelect() {
    return this.page.locator('select[name="outstationStateId"]')
  }

  get submitButton() {
    return this.page.getByRole('button', { name: /submit/i })
  }

  private async readWorkLocationOptions(): Promise<WorkLocationOption[]> {
    const optionsLocator = this.workLocationSelect.locator('option')
    const optionsCount = await optionsLocator.count()
    const options: WorkLocationOption[] = []

    for (let index = 0; index < optionsCount; index += 1) {
      const option = optionsLocator.nth(index)
      const value = (await option.getAttribute('value'))?.trim() ?? ''
      const label = (await option.textContent())?.trim() ?? ''

      if (!value || !label) {
        continue
      }

      options.push({ value, label })
    }

    return options
  }

  async getWorkLocationOptions(): Promise<WorkLocationOption[]> {
    const timeoutMs = 15_000
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      const options = await this.readWorkLocationOptions()

      if (options.length > 0) {
        return options
      }

      await this.page.waitForTimeout(200)
    }

    return this.readWorkLocationOptions()
  }

  async ensureExpenseLocationSelected(timeoutMs = 5_000) {
    const select = this.expenseLocationSelect.first()
    const selectCount = await this.expenseLocationSelect.count().catch(() => 0)

    if (selectCount === 0) {
      return
    }

    await select.waitFor({ state: 'visible', timeout: timeoutMs })

    const currentValue = (await select.inputValue().catch(() => '')).trim()
    if (currentValue) {
      return
    }

    const options = select.locator('option')
    const optionCount = await options.count()

    for (let index = 0; index < optionCount; index += 1) {
      const option = options.nth(index)
      const value = (await option.getAttribute('value'))?.trim() ?? ''

      if (!value) {
        continue
      }

      await select.selectOption({ value })
      return
    }
  }

  async selectExpenseLocationByValue(value: string) {
    await this.expenseLocationSelect.selectOption({ value })
  }

  async selectWorkLocationByValue(value: string) {
    await this.workLocationSelect.selectOption({ value })
    await this.ensureExpenseLocationSelected()
  }

  async selectWorkLocationByName(locationName: string) {
    const normalizedTarget = this.normalizeOptionLabel(locationName)
    const options = await this.getWorkLocationOptions()
    const matchedOption = options.find(
      (option) => this.normalizeOptionLabel(option.label) === normalizedTarget
    )

    if (!matchedOption) {
      throw new Error(
        `Unable to find work location "${locationName}". Available options: ${options
          .map((option) => option.label)
          .join(', ')}`
      )
    }

    await this.selectWorkLocationByValue(matchedOption.value)
  }

  async getWorkLocationNameByValue(value: string): Promise<string | null> {
    const options = await this.getWorkLocationOptions()
    return options.find((option) => option.value === value)?.label ?? null
  }

  // ── List elements ──────────────────────────────────────────────────────

  get claimsSection() {
    return this.page.locator('section:has(h2:has-text("My Claims"))').first()
  }

  get claimRows() {
    return this.claimsSection.locator(
      'table tbody tr, [data-testid="claim-row"]'
    )
  }

  get claimNumberLinks() {
    return this.claimsSection.locator(
      'table tbody tr td a[href*="/claims/"], [data-testid="claim-row"] a[href*="/claims/"]'
    )
  }

  get claimsNextLink() {
    return this.claimsSection.getByRole('link', { name: /^Next$/i }).first()
  }

  get emptyState() {
    return this.page.getByText(/no claims|no records/i)
  }

  getClaimRowByNumber(claimNumber: string) {
    return this.claimRows.filter({ hasText: claimNumber }).first()
  }

  private async moveToNextClaimsPage(
    visitedNextHrefs: Set<string>
  ): Promise<boolean> {
    if ((await this.claimsNextLink.count()) === 0) {
      return false
    }

    const nextHref = await this.claimsNextLink.getAttribute('href')
    if (!nextHref || visitedNextHrefs.has(nextHref)) {
      return false
    }

    const previousUrl = this.page.url()
    visitedNextHrefs.add(nextHref)

    await this.claimsNextLink.click()
    await this.page.waitForLoadState('networkidle')

    return this.page.url() !== previousUrl
  }

  async openClaimByNumber(claimNumber: string) {
    if (new URL(this.page.url()).pathname !== '/claims') {
      await this.goto()
    }

    const claimRow = this.getClaimRowByNumber(claimNumber)
    await claimRow.locator('a[href*="/claims/"]').first().click()
    await this.page.waitForURL(/\/claims\//)
    await this.page.waitForLoadState('networkidle')
    await expect(
      this.page.getByRole('heading', { name: /^Claim Details$/i })
    ).toBeVisible({ timeout: 20_000 })
  }

  async getLatestClaimNumber(timeoutMs = 30_000): Promise<string> {
    const firstClaimLink = this.claimNumberLinks.first()
    await firstClaimLink.waitFor({ state: 'visible', timeout: timeoutMs })

    const claimNumber = (await firstClaimLink.textContent())?.trim()
    if (!claimNumber) {
      throw new Error('Unable to resolve latest claim number from claims list.')
    }

    return claimNumber
  }

  private toDisplayDate(dateIso: string): string {
    const [yyyy, mm, dd] = dateIso.split('-')
    if (!yyyy || !mm || !dd) {
      throw new Error(`Invalid ISO date value: ${dateIso}`)
    }

    return `${dd}/${mm}/${yyyy}`
  }

  async getClaimNumberForDate(
    claimDateIso: string,
    timeoutMs = 30_000
  ): Promise<string> {
    const displayDate = this.toDisplayDate(claimDateIso)
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      if (new URL(this.page.url()).pathname !== '/claims') {
        await this.goto()
      }

      const visitedNextHrefs = new Set<string>()

      for (;;) {
        const matchingRow = this.claimRows
          .filter({ hasText: displayDate })
          .first()

        if ((await matchingRow.count()) > 0) {
          const claimLink = matchingRow.locator('a[href*="/claims/"]').first()

          if ((await claimLink.count()) > 0) {
            const claimNumber = (await claimLink.textContent())?.trim()
            if (claimNumber) {
              return claimNumber
            }
          }
        }

        const movedToNextPage =
          await this.moveToNextClaimsPage(visitedNextHrefs)
        if (!movedToNextPage) {
          break
        }
      }

      await this.page.waitForTimeout(300)
      await this.page.reload({ waitUntil: 'networkidle' })
    }

    throw new Error(
      `Claim number not found for date ${displayDate} in claims list within ${timeoutMs}ms.`
    )
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  async fillBaseLocationClaim(date: string, vehicleType: string) {
    await this.dateInput.fill(date)
    await this.selectWorkLocationByName('Field - Base Location')
    await this.vehicleTypeSelect.selectOption({ label: vehicleType })
  }

  async fillOutstationOwnVehicleClaim(
    date: string,
    vehicleType: string,
    km: number,
    fromCity: string,
    toCity: string
  ) {
    await this.dateInput.fill(date)
    await this.selectWorkLocationByName('Field - Outstation')
    await this.intercityOwnVehicleYesButton.click()
    await this.vehicleTypeSelect.selectOption({ label: vehicleType })
    await this.fromCityInput.selectOption({ label: fromCity })
    await this.toCityInput.selectOption({ label: toCity })
    await this.kmInput.fill(String(km))
  }
}
