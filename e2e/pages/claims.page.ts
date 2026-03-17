import type { Page } from '@playwright/test'

export class ClaimsPage {
  constructor(private page: Page) {}

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
    return this.page.getByLabel(/vehicle type/i)
  }

  // "Own vehicle used?" is a Yes/No button group inside a <fieldset>, not a checkbox
  get ownVehicleYesButton() {
    return this.page
      .getByRole('group', { name: /own vehicle/i })
      .getByRole('button', { name: 'Yes' })
  }

  get ownVehicleNoButton() {
    return this.page
      .getByRole('group', { name: /own vehicle/i })
      .getByRole('button', { name: 'No' })
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

  get transportTypeSelect() {
    return this.page.getByLabel(/transport.*type/i)
  }

  get taxiAmountInput() {
    return this.page.getByLabel(/taxi.*amount|amount/i)
  }

  get submitButton() {
    return this.page.getByRole('button', { name: /submit/i })
  }

  // ── List elements ──────────────────────────────────────────────────────

  get claimRows() {
    return this.page.locator('table tbody tr, [data-testid="claim-row"]')
  }

  get emptyState() {
    return this.page.getByText(/no claims|no records/i)
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  async fillBaseLocationClaim(date: string, vehicleType: string) {
    await this.dateInput.fill(date)
    await this.workLocationSelect.selectOption('Field - Base Location')
    await this.vehicleTypeSelect.selectOption(vehicleType)
  }

  async fillOutstationOwnVehicleClaim(
    date: string,
    vehicleType: string,
    km: number,
    fromCity: string,
    toCity: string
  ) {
    await this.dateInput.fill(date)
    await this.workLocationSelect.selectOption('Field - Outstation')
    await this.ownVehicleYesButton.click()
    await this.vehicleTypeSelect.selectOption(vehicleType)
    await this.kmInput.fill(String(km))
    await this.fromCityInput.selectOption({ label: fromCity })
    await this.toCityInput.selectOption({ label: toCity })
  }
}
