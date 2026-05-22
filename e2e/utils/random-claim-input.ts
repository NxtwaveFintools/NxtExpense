import { type Locator, type Page } from '@playwright/test'

import { ClaimsPage } from '../pages/claims.page'

type SelectOption = {
  value: string
  label: string
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffledCopy<T>(values: T[]): T[] {
  const copy = [...values]

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[randomIndex]] = [copy[randomIndex], copy[i]]
  }

  return copy
}

async function isVisible(locator: Locator): Promise<boolean> {
  return locator.isVisible().catch(() => false)
}

async function readSelectOptions(select: Locator): Promise<SelectOption[]> {
  const optionsLocator = select.locator('option')
  const optionCount = await optionsLocator.count().catch(() => 0)
  const options: SelectOption[] = []

  for (let index = 0; index < optionCount; index += 1) {
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

async function selectRandomOption(
  select: Locator
): Promise<SelectOption | null> {
  const options = await readSelectOptions(select)

  if (options.length === 0) {
    return null
  }

  const selected = shuffledCopy(options)[0]
  await select.selectOption({ value: selected.value })
  return selected
}

async function fillBaseLocationRandomDetails(
  claims: ClaimsPage
): Promise<boolean> {
  const vehicleSelect = claims.vehicleTypeSelect.first()
  const dayTypeSelect = claims.baseLocationDayTypeSelect.first()

  if (await isVisible(dayTypeSelect)) {
    const selectedDayType = await selectRandomOption(dayTypeSelect)
    if (!selectedDayType) {
      return false
    }
  }

  if (await isVisible(vehicleSelect)) {
    const selectedVehicle = await selectRandomOption(vehicleSelect)
    if (!selectedVehicle) {
      return false
    }
  }

  return true
}

async function waitForIntercityCityOptions(
  page: Page,
  claims: ClaimsPage
): Promise<{ fromOptions: SelectOption[]; toOptions: SelectOption[] } | null> {
  const deadline = Date.now() + 2_000

  while (Date.now() < deadline) {
    const fromOptions = await readSelectOptions(claims.fromCityInput)
    const toOptions = await readSelectOptions(claims.toCityInput)

    if (fromOptions.length > 1 && toOptions.length > 1) {
      return { fromOptions, toOptions }
    }

    await page.waitForTimeout(150)
  }

  return null
}

async function fillOutstationIntercityRandomDetails(
  page: Page,
  claims: ClaimsPage
): Promise<number | null> {
  await claims.intercityOwnVehicleYesButton.click()

  const stateSelectVisible = await claims.outstationStateSelect
    .waitFor({ state: 'visible', timeout: 3_000 })
    .then(() => true)
    .catch(() => false)

  if (!stateSelectVisible) {
    return null
  }

  const allStateOptions = shuffledCopy(
    await readSelectOptions(claims.outstationStateSelect)
  )

  // Try at most 3 states to avoid excessive waits when cities are slow to load
  const stateOptions = allStateOptions.slice(0, 3)

  for (const stateOption of stateOptions) {
    const selected = await claims.outstationStateSelect
      .selectOption({ value: stateOption.value }, { timeout: 5_000 })
      .then(() => true)
      .catch(() => false)

    if (!selected) {
      return null
    }

    const cityOptions = await waitForIntercityCityOptions(page, claims)
    if (!cityOptions) {
      continue
    }

    const fromOption = shuffledCopy(cityOptions.fromOptions)[0]
    const eligibleToOptions = cityOptions.toOptions.filter(
      (option) => option.value !== fromOption.value
    )

    if (eligibleToOptions.length === 0) {
      continue
    }

    const toOption = shuffledCopy(eligibleToOptions)[0]

    await claims.fromCityInput.selectOption({ value: fromOption.value })
    await claims.toCityInput.selectOption({ value: toOption.value })

    const selectedVehicle = await selectRandomOption(
      claims.vehicleTypeSelect.first()
    )
    if (!selectedVehicle) {
      continue
    }

    const kmTravelled = randomInt(15, 140)
    await claims.kmInput.fill(String(kmTravelled))

    return kmTravelled
  }

  return null
}

export async function fillRandomPayableClaimInputs(
  page: Page,
  claims: ClaimsPage,
  claimDateIso: string
): Promise<{ workLocationLabel: string; kmTravelled?: number }> {
  await claims.ensureNewClaimFormReady()
  await claims.fillClaimDate(claimDateIso)

  const workLocationOptions = shuffledCopy(
    await claims.getWorkLocationOptions()
  )

  for (const option of workLocationOptions) {
    await claims.selectWorkLocationByValue(option.value)
    await page.waitForTimeout(120)

    if (await isVisible(claims.intercityOwnVehicleGroup)) {
      const kmTravelled = await fillOutstationIntercityRandomDetails(
        page,
        claims
      )

      if (kmTravelled !== null) {
        return {
          workLocationLabel: option.label,
          kmTravelled,
        }
      }

      continue
    }

    const hasVehicleSelection = await isVisible(
      claims.vehicleTypeSelect.first()
    )
    const hasBaseDayTypeSelection = await isVisible(
      claims.baseLocationDayTypeSelect.first()
    )

    if (hasVehicleSelection || hasBaseDayTypeSelection) {
      const isFilled = await fillBaseLocationRandomDetails(claims)

      if (isFilled) {
        return {
          workLocationLabel: option.label,
        }
      }
    }
  }

  const fallbackOptions = await claims.getWorkLocationOptions()

  if (fallbackOptions.length === 0) {
    throw new Error('No work location options are available on the claim form.')
  }

  const fallback = shuffledCopy(fallbackOptions)[0]
  await claims.selectWorkLocationByValue(fallback.value)

  return {
    workLocationLabel: fallback.label,
  }
}
