// Type-only imports: this file stays free of the SDK so unit tests can load it.
import type {
  AdminCreateDriverPayload,
  DriverVehicleType,
} from "../../lib/drivers"

export const DRIVER_STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const

export type DriverStatusFilter = (typeof DRIVER_STATUS_FILTERS)[number]["value"]

// "all" sends no filter; the others map to the API's `is_active` query param.
export const statusFilterToQuery = (
  filter: DriverStatusFilter
): { is_active?: boolean } => {
  switch (filter) {
    case "active":
      return { is_active: true }
    case "inactive":
      return { is_active: false }
    default:
      return {}
  }
}

const VEHICLE_TYPE_LABELS: Record<DriverVehicleType, string> = {
  motorcycle: "Motorcycle",
  car: "Car",
  bicycle: "Bicycle",
}

// Takes any string: the API may return a type this admin build does not know
// yet, which is shown as-is.
export const vehicleTypeLabel = (type: string): string =>
  Object.prototype.hasOwnProperty.call(VEHICLE_TYPE_LABELS, type)
    ? VEHICLE_TYPE_LABELS[type as DriverVehicleType]
    : type

export const formatDriverName = (driver: {
  first_name: string
  last_name: string
}) => `${driver.first_name} ${driver.last_name}`.trim()

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
