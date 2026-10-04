// Driver display helpers shared by the Drivers page and the order widget.
// Type-only imports: this file stays free of the SDK so unit tests can load it.
import type { DriverVehicleType } from "./drivers"

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
