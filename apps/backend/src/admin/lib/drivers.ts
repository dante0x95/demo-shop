import {
  DRIVER_VEHICLE_TYPES,
  DriverVehicleType,
} from "../../modules/driver/utils/vehicle-types"
import { sdk } from "./sdk"

export { DRIVER_VEHICLE_TYPES }
export type { DriverVehicleType }

export type AdminDriver = {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  vehicle_type: DriverVehicleType
  license_plate: string | null
  is_active: boolean
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type AdminDriverListResponse = {
  drivers: AdminDriver[]
  count: number
  offset: number
  limit: number
}

export type AdminDriverResponse = {
  driver: AdminDriver
}

export type AdminDriverListParams = {
  limit: number
  offset: number
  order?: string
  is_active?: boolean
}

// Fields the form leaves empty are omitted, so the API's own 400 explains
// what is missing.
export type AdminCreateDriverPayload = {
  first_name: string
  last_name: string
  email: string
  phone: string
  vehicle_type?: DriverVehicleType
  license_plate?: string
  is_active: boolean
}

export const driverQueryKeys = {
  all: ["drivers"] as const,
  list: (params: AdminDriverListParams) =>
    ["drivers", "list", params] as const,
}

export const listDrivers = (params: AdminDriverListParams) =>
  sdk.client.fetch<AdminDriverListResponse>("/admin/drivers", {
    query: params,
  })

// Also emails the driver an invitation to set their password.
export const createDriver = (body: AdminCreateDriverPayload) =>
  sdk.client.fetch<AdminDriverResponse>("/admin/drivers", {
    method: "POST",
    body,
  })

// Emails a new invitation link; the previous one stops working.
export const resendDriverInvite = (id: string) =>
  sdk.client.fetch<AdminDriverResponse>(
    `/admin/drivers/${id}/resend-invite`,
    { method: "POST", body: {} }
  )
