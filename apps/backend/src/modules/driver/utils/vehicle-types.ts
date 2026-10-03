// The vehicles a driver can deliver with. Plain data with no Node APIs, so the
// admin UI can import it too.
export const DRIVER_VEHICLE_TYPES = ["motorcycle", "car", "bicycle"] as const

export type DriverVehicleType = (typeof DRIVER_VEHICLE_TYPES)[number]
