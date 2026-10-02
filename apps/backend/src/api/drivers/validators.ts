import { z } from "@medusajs/framework/zod"
import { createSelectParams } from "@medusajs/medusa/api/utils/validators"
import { DRIVER_VEHICLE_TYPES } from "../../modules/driver/models/driver"

export const GetDriverParams = createSelectParams()

export type GetDriverParamsType = z.infer<typeof GetDriverParams>

export const GetDriverMeParams = z.strictObject({
  ...createSelectParams().shape,
})

export type GetDriverMeParamsType = z.infer<typeof GetDriverMeParams>

// email comes from the auth identity and is_active is set by admins, so
// neither is accepted here.
export const CreateDriver = z.strictObject({
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  vehicle_type: z.enum(DRIVER_VEHICLE_TYPES),
  license_plate: z.string().trim().min(1).nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
})

export type CreateDriverType = z.infer<typeof CreateDriver>
