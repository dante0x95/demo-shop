// Type-only imports: this file stays free of the SDK so unit tests can load it.
import type {
  AdminCreateDriverPayload,
  DriverVehicleType,
} from "../../lib/drivers"

export type CreateDriverFormState = {
  first_name: string
  last_name: string
  email: string
  phone: string
  vehicle_type: DriverVehicleType | ""
  license_plate: string
  is_active: boolean
}

// Required fields are sent as typed, so the API's 400 names any that are
// missing. Optional ones left blank are omitted: the API rejects an empty
// license plate, and a driver without one is valid.
export const toCreateDriverPayload = (
  form: CreateDriverFormState
): AdminCreateDriverPayload => {
  const payload: AdminCreateDriverPayload = {
    first_name: form.first_name,
    last_name: form.last_name,
    email: form.email.trim(),
    phone: form.phone,
    is_active: form.is_active,
  }

  if (form.vehicle_type) {
    payload.vehicle_type = form.vehicle_type
  }

  const licensePlate = form.license_plate.trim()

  if (licensePlate) {
    payload.license_plate = licensePlate
  }

  return payload
}
