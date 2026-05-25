export type AdminState = {
  id: string
  state_code: string
  state_name: string
  is_active: boolean
  display_order: number
}

export type AdminCity = {
  id: string
  city_name: string
  state_id: string
  is_active: boolean
  display_order: number
}

export type BulkImportSummary = {
  stateId: string
  stateName: string
  totalTokens: number
  insertedCount: number
  duplicateCount: number
  invalidCount: number
  insertedCities: string[]
  duplicateCities: string[]
  invalidCities: string[]
}
