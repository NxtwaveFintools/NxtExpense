import type { IntracityVehicleMode } from '@/features/claims/types'

type SetValue<T> = (value: T) => void

type CreateTravelSelectionHandlersParams = {
  intercityOwnVehicleUsed: boolean | null
  setIntercityOwnVehicleUsed: SetValue<boolean | null>
  setIntracityTravelUsed: SetValue<boolean | null>
  setIntracityVehicleMode: SetValue<IntracityVehicleMode | null>
  setOutstationCityId: SetValue<string>
  setOutstationStateId: SetValue<string>
  setFromCityId: SetValue<string>
  setToCityId: SetValue<string>
  setKmTravelled: SetValue<string>
}

export function createTravelSelectionHandlers({
  intercityOwnVehicleUsed,
  setIntercityOwnVehicleUsed,
  setIntracityTravelUsed,
  setIntracityVehicleMode,
  setOutstationCityId,
  setOutstationStateId,
  setFromCityId,
  setToCityId,
  setKmTravelled,
}: CreateTravelSelectionHandlersParams) {
  function handleIntercityOwnVehicleUsedChange(value: boolean) {
    setIntercityOwnVehicleUsed(value)

    if (value) {
      setIntracityTravelUsed(null)
      setIntracityVehicleMode(null)
      setOutstationCityId('')
      return
    }

    setFromCityId('')
    setToCityId('')
    setKmTravelled('')
    setIntracityTravelUsed(null)
    setIntracityVehicleMode(null)
    setOutstationStateId('')
    setOutstationCityId('')
  }

  function handleIntracityTravelUsedChange(value: boolean) {
    setIntracityTravelUsed(value)

    if (!value) {
      setIntracityVehicleMode(null)
      setOutstationCityId('')

      if (intercityOwnVehicleUsed !== true) {
        setOutstationStateId('')
      }

      return
    }

    if (intercityOwnVehicleUsed === true) {
      setIntercityOwnVehicleUsed(false)
      setKmTravelled('')
      setFromCityId('')
      setToCityId('')
    }
  }

  function handleIntracityVehicleModeChange(value: IntracityVehicleMode) {
    setIntracityVehicleMode(value)
  }

  function handleOutstationStateChange(value: string) {
    setOutstationStateId(value)
    setOutstationCityId('')
    setFromCityId('')
    setToCityId('')
  }

  return {
    handleIntercityOwnVehicleUsedChange,
    handleIntracityTravelUsedChange,
    handleIntracityVehicleModeChange,
    handleOutstationStateChange,
  }
}
