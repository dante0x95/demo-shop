import { model } from "@medusajs/framework/utils"
import DriverInvite from "./driver-invite"

export const DRIVER_VEHICLE_TYPES = ["motorcycle", "car", "bicycle"] as const

const Driver = model.define("driver", {
  id: model.id({ prefix: "drv" }).primaryKey(),
  first_name: model.text(),
  last_name: model.text(),
  // Copied from the driver's emailpass auth identity at registration.
  email: model.text().unique(),
  phone: model.text(),
  vehicle_type: model.enum([...DRIVER_VEHICLE_TYPES]),
  license_plate: model.text().nullable(),
  // Self-registered drivers wait for an admin to activate them.
  is_active: model.boolean().default(false),
  metadata: model.json().nullable(),
  // Drivers created from the admin get one; self-registered drivers don't.
  invite: model.hasOne(() => DriverInvite, { mappedBy: "driver" }).nullable(),
})

export default Driver
