import type { Page } from '@playwright/test'

type WorkLocationOption = {
  value: string
  label: string
}

export class ClaimsPage {
  constructor(private page: Page) {}

  private normalizeOptionLabel(value: string): string {
    return value.replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase()
  }

  async goto() {
    await this.page.goto('/claims')
    await this.page.waitForLoadState('networkidle')
  }

  async gotoNewClaim() {
    await this.page.goto('/claims/new')
    await this.page.waitForLoadState('networkidle')
  }

  // ── Form elements ──────────────────────────────────────────────────────

  get dateInput() {
    return this.page.getByLabel(/date/i).first()
  }

  get workLocationSelect() {
    return this.page.getByLabel(/work location/i)
  }

  get vehicleTypeSelect() {
    return this.page.locator('select[name="vehicleType"]')
  }

  get intercityOwnVehicleGroup() {
    return this.page.getByRole('group', {
      name: /did you travel between cities using your own vehicle\?/i,
    })
  }

  get intracityOwnVehicleGroup() {
    return this.page.getByRole('group', {
      name: /did you travel within the city using your own vehicle\?/i,
    })
  }

  get outstationCitySelect() {
    return this.page.locator('select[name="outstationCityId"]')
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

  async selectWorkLocationByValue(value: string) {
    await this.workLocationSelect.selectOption({ value })
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

  get claimRows() {
    return this.page.locator('table tbody tr, [data-testid="claim-row"]')
  }

  get claimNumberLinks() {
    return this.page.locator(
      'table tbody tr td:first-child a[href*="/claims/"]'
    )
  }

  get emptyState() {
    return this.page.getByText(/no claims|no records/i)
  }

  getClaimRowByNumber(claimNumber: string) {
    return this.claimRows.filter({ hasText: claimNumber }).first()
  }

  async openClaimByNumber(claimNumber: string) {
    const claimRow = this.getClaimRowByNumber(claimNumber)
    await claimRow.locator('a[href*="/claims/"]').first().click()
    await this.page.waitForURL(/\/claims\//)
    await this.page.waitForLoadState('networkidle')
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
