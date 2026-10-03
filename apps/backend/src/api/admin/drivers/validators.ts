import { z } from "@medusajs/framework/zod"
import {
  createFindParams,
  createSelectParams,
} from "@medusajs/medusa/api/utils/validators"
import { DRIVER_VEHICLE_TYPES } from "../../../modules/driver/models/driver"

export const AdminGetDriverParams = createSelectParams()

export type AdminGetDriverParamsType = z.infer<typeof AdminGetDriverParams>

// Query strings carry booleans as text; anything but "true"/"false" is a 400.
const booleanQuery = z
  .enum(["true", "false"])
  .transform((value) => value === "true")

// `is_active=false` lists self-registered drivers waiting for approval.
// `with_deleted` is left out: nothing in the API soft-deletes drivers yet.
export const AdminGetDriversParams = z.strictObject({
  ...createFindParams({ limit: 20, offset: 0, order: "-created_at" }).omit({
    with_deleted: true,
  }).shape,
  is_active: booleanQuery.optional(),
})

export type AdminGetDriversParamsType = z.infer<typeof AdminGetDriversParams>

// Same fields as self-registration (POST /drivers), plus the email (there is
// no auth identity to copy it from) and is_active.
export const AdminCreateDriver = z.strictObject({
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
  email: z.email(),
  phone: z.string().trim().min(1),
  vehicle_type: z.enum(DRIVER_VEHICLE_TYPES),
  license_plate: z.string().trim().min(1).nullish(),
  is_active: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
})

export type AdminCreateDriverType = z.infer<typeof AdminCreateDriver>
